// Isolated GoTrue + temporary PostgreSQL + loopback-only SMTP. Never accepts production credentials.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {Pool} from 'pg';
const binary=path.resolve('.audit/auth-tools/supabase-auth.exe');
const pg=await import(`@embedded-postgres/${process.platform==='win32'?'windows':process.platform}-${process.arch}`);
const root=await mkdtemp(path.join(tmpdir(),'perkdrop-auth-qa-')),data=path.join(root,'data'),password=randomBytes(32).toString('hex');
const freePort=()=>new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const dbPort=await freePort(),apiPort=await freePort(),smtpPort=await freePort();
const base=`http://127.0.0.1:${apiPort}`,redirect='http://127.0.0.1:4199/claim?merchant=isolated-fixture';
const run=(exe,args)=>new Promise((resolve,reject)=>{const c=spawn(exe,args,{windowsHide:true});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('error',reject);c.on('exit',code=>{c.stdout.destroy();c.stderr.destroy();code?reject(Error(out)):resolve(out);});});
const mails=[],sockets=new Set();
const smtp=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.write('220 localhost isolated QA\r\n');let buffer='',body='',inData=false;
  socket.on('data',d=>{buffer+=d;let i;while((i=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+2);if(inData){if(line==='.') {mails.push(body);body='';inData=false;socket.write('250 accepted locally only\r\n');}else body+=line+'\r\n';}
    else if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 8BITMIME\r\n');
    else if(/^MAIL|^RCPT|^RSET|^NOOP/.test(line))socket.write('250 OK\r\n');
    else if(line==='DATA'){inData=true;socket.write('354 end with dot\r\n');}
    else if(line==='QUIT'){socket.end('221 bye\r\n');}
    else socket.write('502 unsupported\r\n');
  }});
});
let auth,pool,started=false,authLog='',passed=0;
const check=(condition,name)=>{assert.ok(condition,name);passed++;console.log('ISOLATED AUTH PASS: '+name);};
const request=(route,body,token)=>fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
const waitMail=async(count)=>{for(let i=0;i<100&&mails.length<count;i++)await new Promise(r=>setTimeout(r,100));assert.ok(mails.length>=count,'Local SMTP received message');const decoded=mails.at(-1).replace(/=\r\n/g,'').replace(/=([\da-f]{2})/ig,(_,h)=>String.fromCharCode(parseInt(h,16))).replaceAll('&amp;','&');const url=decoded.match(/https?:\/\/[^\s"<>]+\/verify\?[^\s"<>]+/);assert.ok(url,'Verification URL in captured email');return url[0];};
try{
  await writeFile(path.join(root,'password'),password,{mode:0o600});
  await run(pg.initdb,['-D',data,'-U','postgres','--auth=scram-sha-256',`--pwfile=${path.join(root,'password')}`,'--encoding=UTF8','--locale=C']);
  await run(pg.pg_ctl,['-D',data,'-l',path.join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${dbPort}`,'-w','start']);started=true;
  pool=new Pool({host:'127.0.0.1',port:dbPort,user:'postgres',password,database:'postgres'});
  await pool.query('create schema auth; alter role postgres set search_path=auth,public');
  await new Promise(r=>smtp.listen(smtpPort,'127.0.0.1',r));
  auth=spawn(binary,[],{cwd:path.resolve('.audit/auth-source'),windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:root,TMP:root,
    GOTRUE_JWT_SECRET:randomBytes(40).toString('hex'),GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
    GOTRUE_DB_DRIVER:'postgres',DB_NAMESPACE:'auth',DATABASE_URL:`postgres://postgres:${password}@127.0.0.1:${dbPort}/postgres?sslmode=disable`,
    API_EXTERNAL_URL:base,GOTRUE_API_HOST:'127.0.0.1',PORT:String(apiPort),GOTRUE_SITE_URL:'http://127.0.0.1:4199',GOTRUE_URI_ALLOW_LIST:'http://127.0.0.1:4199/**',
    GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_MAILER_AUTOCONFIRM:'false',GOTRUE_MAILER_URLPATHS_CONFIRMATION:'/verify',GOTRUE_MAILER_URLPATHS_RECOVERY:'/verify',
    GOTRUE_SMTP_HOST:'127.0.0.1',GOTRUE_SMTP_PORT:String(smtpPort),GOTRUE_SMTP_ADMIN_EMAIL:'qa@example.invalid',GOTRUE_SMTP_SENDER_NAME:'Isolated QA',GOTRUE_SMTP_MAX_FREQUENCY:'0s',GOTRUE_RATE_LIMIT_EMAIL_SENT:'1000',GOTRUE_LOG_LEVEL:'error'}});
  auth.stdout.on('data',d=>authLog+=d);auth.stderr.on('data',d=>authLog+=d);
  let ready=false;for(let i=0;i<150;i++){try{ready=(await fetch(base+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw Error('Local Auth did not start: '+authLog.replaceAll(password,'[redacted]'));
  const email='claimant@example.invalid',pass=randomBytes(24).toString('hex');
  let res=await request('/signup?redirect_to='+encodeURIComponent(redirect),{email,password:pass});if(!res.ok)throw Error('Isolated signup '+res.status+': '+await res.text()+'; '+authLog.replaceAll(password,'[redacted]'));check(res.ok,'signup accepted by real isolated Auth');
  const confirmation=await waitMail(1);check(confirmation.includes('redirect_to='),'verification email captured locally with redirect');
  res=await request('/token?grant_type=password',{email,password:pass});check(res.status===400,'unverified email cannot sign in');
  res=await fetch(confirmation,{redirect:'manual'});let location=res.headers.get('location')||'';
  check(res.status===303||res.status===302,'email verification redirects');check(location.startsWith(redirect+'#'),'selected business retained through verification');
  const access=new URLSearchParams(location.split('#')[1]).get('access_token');check(!!access,'verified session returned');
  res=await fetch(confirmation,{redirect:'manual'});check(/error/.test(res.headers.get('location')||''),'reused verification link rejected');
  res=await request('/recover?redirect_to='+encodeURIComponent(redirect+'&recovery=1'),{email});check(res.ok,'password recovery accepted');
  const recovery=await waitMail(2);res=await fetch(recovery,{redirect:'manual'});location=res.headers.get('location')||'';
  check(location.startsWith(redirect+'&recovery=1#')&&location.includes('type=recovery'),'recovery retains selected business and recovery session');
  const recovered=new URLSearchParams(location.split('#')[1]).get('access_token');
  res=await fetch(base+'/user',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+recovered},body:JSON.stringify({password:pass+'Changed'})});check(res.ok,'recovered user can set a new password');
  const expiredEmail='expired@example.invalid';await request('/signup?redirect_to='+encodeURIComponent(redirect),{email:expiredEmail,password:pass});const expiredLink=await waitMail(3);
  await pool.query("update auth.users set confirmation_sent_at=now()-interval '2 days' where email=$1",[expiredEmail]);
  res=await fetch(expiredLink,{redirect:'manual'});check(/error/.test(res.headers.get('location')||''),'expired verification link rejected using isolated clock evidence');
  await request('/resend',{type:'signup',email:expiredEmail});await waitMail(4);check(mails.length===4,'resend produces a new local verification email');
  console.log(`ISOLATED AUTH RESULT: ${passed} checks; ${mails.length} messages captured on loopback; no external email, production users or ownership created.`);
  await writeFile('.audit/auth-isolated-result.json',JSON.stringify({testedAt:new Date().toISOString(),checks:passed,localSmtpMessages:mails.length,productionEmailDelivery:false,authSourceCommit:'4eee58f296d9698a1c2c0ae14d7a0b379c7622d3',platformPatch:'Windows local listener without Unix SO_REUSEPORT'},null,2));
}finally{
  if(auth){auth.kill();await new Promise(r=>auth.once('exit',r));}
  for(const socket of sockets)socket.destroy();await new Promise(r=>smtp.close(r));
  if(pool)await pool.end();if(started)await run(pg.pg_ctl,['-D',data,'-m','immediate','-w','stop']);
  const parent=path.resolve(tmpdir()),target=path.resolve(root);assert.ok(path.dirname(target)===parent&&path.basename(target).startsWith('perkdrop-auth-qa-'),'Safe isolated cleanup target');
  await rm(target,{recursive:true,force:true});
}
