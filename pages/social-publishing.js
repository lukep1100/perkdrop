import Head from 'next/head';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@supabase/supabase-js';

const BASE='https://khzpdyyywiucfhubxkev.supabase.co';
const PUBLIC_KEY='sb_publishable_2UrOe1GGD02EMsYndb9rPw_TNctbZAl';
let client;
const sb=()=>client||(client=createClient(BASE,PUBLIC_KEY));
const stamp=value=>value?new Date(value).toLocaleString('en-AU'):'—';
const statusLabel={uploading:'Awaiting upload',verifying:'Verifying original PNGs',verification_failed:'Verification failed',
  ready:'Verified private preview — awaiting approval',drafting:'Creating owner-approved drafts',
  draft_failed:'Buffer rejected a draft',reconciliation_required:'Check Buffer — result uncertain',drafted:'Buffer API verified drafts'};
export default function SocialPublishing(){
  const [session,setSession]=useState(undefined),[jobs,setJobs]=useState([]),[job,setJob]=useState(null),[events,setEvents]=useState([]);
  const [settings,setSettings]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [files,setFiles]=useState([]),[caption,setCaption]=useState(''),[title,setTitle]=useState('');
  const [channels,setChannels]=useState(['instagram','facebook']),[approved,setApproved]=useState(false);
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const jobId=useRef(null);
  useEffect(()=>{
    let live=true;
    sb().auth.getSession().then(({data})=>live&&setSession(data.session));
    const {data:{subscription}}=sb().auth.onAuthStateChange((_event,s)=>{if(live)setSession(s);});
    return()=>{live=false;subscription.unsubscribe();};
  },[]);
  async function api(body){
    const {data}=await sb().auth.getSession();
    if(!data.session)throw new Error('Sign in with your PerkDrop owner account.');
    const r=await fetch(BASE+'/functions/v1/perkdrop-social-admin',{method:'POST',
      headers:{'content-type':'application/json',apikey:PUBLIC_KEY,authorization:'Bearer '+data.session.access_token},
      body:JSON.stringify(body)});
    const value=await r.json();if(!r.ok)throw new Error(value.error||'Request failed.');return value;
  }
  async function openJob(id){
    const result=await api({action:'get',job_id:id});setJob(result.job);setEvents(result.events);setApproved(false);
    window.history.replaceState(null,'','/social-publishing?job='+id);
  }
  async function refresh(){
    const result=await api({action:'list'});setJobs(result.jobs);setSettings(result.settings);
    const selected=new URLSearchParams(window.location.search).get('job')||job?.id||result.jobs[0]?.id;
    if(selected)await openJob(selected);
  }
  useEffect(()=>{
    if(!session){setJobs([]);setJob(null);setSettings(null);return;}
    let live=true;refresh().catch(e=>live&&setError(e.message));
    return()=>{live=false;};
  },[session?.user?.id]);
  async function run(fn){setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function uploadAndVerify(existing){
    const source=files.length===5?files:null;
    if(!source)throw new Error('Select the same five original files before resuming an upload.');
    const {uploads}=await api({action:'upload_urls',job_id:existing.id});
    for(const u of uploads){
      const file=source[u.order-1];
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==existing.assets[u.order-1].sha256)throw new Error('Selected files differ from this immutable preview. Create a new job.');
      const {error:uploadError}=await sb().storage.from('social-publishing').uploadToSignedUrl(u.path,u.token,file,{contentType:'image/png'});
      // A content-addressed file may already exist. Verification below still checks every byte.
      if(uploadError && !/already exists|duplicate/i.test(uploadError.message))throw new Error('Slide '+u.order+' upload failed: '+uploadError.message);
    }
    await api({action:'verify',job_id:existing.id});await refresh();
  }
  async function create(e){
    e.preventDefault();await run(async()=>{
      if(files.length!==5)throw new Error('Select exactly five finished PNGs.');
      const manifest=[];
      for(const f of files){
        if(!f.name.toLowerCase().endsWith('.png')||f.size>8000000)throw new Error('Use PNG files no larger than 8 MB.');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
        manifest.push({filename:f.name,byte_size:f.size,sha256:hash});
      }
      if(!jobId.current)jobId.current=crypto.randomUUID();
      const result=await api({action:'create',job_id:jobId.current,title,caption,channels,files:manifest});
      setJob(result.job);await openJob(result.job.id);await uploadAndVerify(result.job);jobId.current=null;
    });
  }
  const canApprove=settings?.enabled===true&&job&&['ready','draft_failed'].includes(job.status)&&job.verification.length===5&&job.verification.every(v=>v.ok);
  return <><Head><title>Social publishing · PerkDrop</title><meta name="robots" content="noindex,nofollow"/></Head>
    <main className="social"><header><div><p className="eyebrow">PERKDROP / PRIVATE OPERATIONS</p><h1>Social publishing</h1>
    <p>Exact finished images. Owner approval. Nothing scheduled or published here.</p></div><a href="/admin">Back to HQ</a></header>
    {error&&<p role="alert" className="error">{error}</p>}
    {session===undefined?<p>Checking owner session…</p>:!session?<section className="panel login"><h2>Owner sign-in</h2>
      <p>Captions, previews and job history are private. Sign in with your existing PerkDrop owner account.</p>
      <form onSubmit={e=>{e.preventDefault();run(async()=>{const {error}=await sb().auth.signInWithPassword({email,password});setPassword('');if(error)throw new Error('Could not sign in. Check your owner credentials.');});}}>
        <label>Email<input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Password<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button disabled={busy}>Open private workspace</button></form></section>:<>
      <div className="actions"><button disabled={busy} onClick={()=>run(refresh)}>Refresh status</button><button disabled={busy} onClick={()=>run(async()=>{await api({action:'check_buffer'});await refresh();})}>Check Buffer connection (read-only)</button>
        <button onClick={()=>sb().auth.signOut()}>Sign out</button></div>
      {settings&&<aside className="warning"><strong>Buffer key rotation: before {settings.buffer_key_expires_at}.</strong> Key stays in Supabase Vault.
        {new Date()>=new Date(settings.key_rotation_warning_at+'T00:00:00Z')?' Rotation warning is now active.':''}
        <p>Connection checked: {stamp(settings.buffer_checked_at)} · {settings.buffer_connection_error||'No recorded connection error'}</p>
        <p>Automatic publisher disabled. TikTok excluded. Hosted image URLs are public; this workspace and caption are owner-only.</p></aside>}
      <div className="layout"><aside><section className="panel"><h2>Saved jobs</h2>{jobs.length===0&&<p>No saved previews.</p>}
        {jobs.map(j=><button className={'job-link '+(job?.id===j.id?'selected':'')} disabled={busy} key={j.id} onClick={()=>run(()=>openJob(j.id))}>
          <strong>{j.title}</strong><small>{statusLabel[j.status]}<br/>{stamp(j.created_at)}</small></button>)}</section>
        <details className="panel"><summary>New five-slide carousel</summary><form onSubmit={create}>
          <label>Internal title<input required maxLength={160} value={title} onChange={e=>{setTitle(e.target.value);jobId.current=null;}}/></label>
          <label>Five finished PNGs<input type="file" accept="image/png,.png" multiple onChange={e=>{setFiles(Array.from(e.target.files).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})));jobId.current=null;}}/></label>
          <ol>{files.map(f=><li key={f.name}>{f.name}</li>)}</ol><p>Filename order is carousel order. Files are never redesigned or substituted.</p>
          <label>Exact caption<textarea rows={12} required maxLength={2200} value={caption} onChange={e=>{setCaption(e.target.value);jobId.current=null;}}/></label>
          {['instagram','facebook'].map(c=><label className="check" key={c}><input type="checkbox" checked={channels.includes(c)} onChange={e=>{setChannels(e.target.checked?[...channels,c]:channels.filter(x=>x!==c));jobId.current=null;}}/>{c==='instagram'?'Instagram @perkdropofficial':'Facebook Perkdrop'}</label>)}
          <button disabled={busy||files.length!==5||!channels.length}>Save private preview & verify PNGs</button></form></details></aside>
      <div>{job?<><section className="panel"><p className="eyebrow">PRIVATE PREVIEW · NOT A BUFFER DRAFT</p><h2>{job.title}</h2>
        <p className={'status '+(job.status==='verification_failed'?'error':'')}>{statusLabel[job.status]}</p>
        <p>{job.channels.map(c=>c.platform+': '+c.name).join(' · ')}</p><p className="mono">Job {job.id}</p>
        {job.error&&<p role="alert" className="error">{job.error.code}: {job.error.message}</p>}
        <div className="slides">{job.assets.map(a=>{const check=job.verification.find(v=>v.order===a.order);return <figure key={a.order}>
          <a href={a.public_url} target="_blank" rel="noreferrer"><img src={a.public_url} alt={'Original slide '+a.order+' — '+a.filename} width="1080" height="1080"/></a>
          <figcaption><strong>{a.order}. {a.filename}</strong><p>{check?.ok?'Verified PNG · '+check.width+' × '+check.height:check?.error||'Not verified'}</p>
          <a href={a.public_url} target="_blank" rel="noreferrer">Hosted original</a><details><summary>SHA-256</summary><code>{a.sha256}</code></details></figcaption></figure>;})}</div>
        <h3>Exact caption</h3><p className="caption">{job.caption}</p><p>Last verification: {stamp(job.verified_at)}</p>
        {['uploading','verification_failed'].includes(job.status)&&<div className="actions">
          <button disabled={busy} onClick={()=>run(async()=>{await api({action:'verify',job_id:job.id});await refresh();})}>{job.status==='uploading'?'Verify hosted files':'Retry failed verification'}</button>
          <button disabled={busy||files.length!==5} onClick={()=>run(()=>uploadAndVerify(job))}>Resume original file upload</button></div>}
        {['verifying','drafting'].includes(job.status)&&<button disabled={busy||Date.now()-Date.parse(job.updated_at)<180000} onClick={()=>run(async()=>{await api({action:'recover',job_id:job.id});await refresh();})}>Recover stalled operation</button>}
        <hr/><h3>Owner approval — Buffer drafts only</h3><p>{settings?.enabled===true?'Creates genuine drafts in the selected Buffer channels. It does not queue, schedule or publish. Approval is locked until every original PNG passes verification.':'Buffer publishing is disabled in production. No draft approval or Buffer request is available until the owner enables and verifies the integration.'}</p>
        <label className="check"><input type="checkbox" checked={approved} disabled={!canApprove||busy} onChange={e=>setApproved(e.target.checked)}/>I have reviewed all five images, their order, channels and exact caption.</label>
        <button disabled={!canApprove||!approved||busy} onClick={()=>run(async()=>{if(!window.confirm('Create genuine Buffer drafts for this exact preview? Nothing will be scheduled or published.'))return;
          await api({action:'approve_drafts',job_id:job.id,preview_hash:job.preview_hash,confirmation:'CREATE_BUFFER_DRAFTS'});await refresh();})}>{job.status==='draft_failed'?'Retry rejected draft only':'Approve & create Buffer drafts'}</button>
        <p>Buffer posts: {Object.keys(job.buffer_posts).length?JSON.stringify(job.buffer_posts):'None created for this job.'}</p>
        {job.status==='reconciliation_required'&&<p className="error">An earlier Buffer request may have succeeded. Creation is locked to prevent duplicates. Inspect the actual Buffer account and recorded IDs.</p>}
      </section><section className="panel"><h2>Status history</h2><ol className="history">{events.map(e=><li key={e.id}><strong>{statusLabel[e.status]||e.status}</strong> · {stamp(e.created_at)}{e.detail?.error&&<p>{e.detail.error.message}</p>}</li>)}</ol></section></>:<section className="panel">Choose a saved job or create a new private preview.</section>}</div></div>
    </>}</main>
    <style jsx>{`
      .social{max-width:1440px;margin:auto;padding:36px 24px 80px;font:16px/1.5 system-ui,sans-serif;color:#152b27}
      header{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:28px}h1{font-size:38px;line-height:1.1;margin:8px 0}h2{margin-top:0}
      .eyebrow{font-size:12px;letter-spacing:.12em;font-weight:800;color:#247157}.layout{display:grid;grid-template-columns:300px 1fr;gap:24px}
      .panel{border:1px solid #d6e0db;border-radius:16px;padding:24px;margin:20px 0;background:white}.warning{padding:18px 22px;border:1px solid #d9c271;background:#fff9e6;border-radius:12px;margin-top:18px}
      .warning p{margin:5px 0}.actions{display:flex;gap:10px;flex-wrap:wrap}button{padding:11px 16px;border:1px solid #a9bfb4;border-radius:9px;background:#edf6ef;color:#163e2d;cursor:pointer;font:inherit;font-weight:600}
      button:disabled{opacity:.45;cursor:not-allowed}a{color:#176243}label{display:block;margin:15px 0}input:not([type=checkbox]),textarea{display:block;width:100%;box-sizing:border-box;padding:11px;border:1px solid #8ca79a;border-radius:7px;font:inherit;margin:6px 0}input[type=checkbox]{width:18px;height:18px;margin-right:8px}.check{display:flex;gap:6px;align-items:flex-start}
      .job-link{display:block;text-align:left;width:100%;margin:10px 0;background:#fafcfb}.job-link.selected{border:2px solid #247157}.job-link small{display:block;font-size:12px;font-weight:400;margin-top:7px}
      .slides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:24px 0}figure{margin:0;border:1px solid #dae2de;border-radius:10px;overflow:hidden}img{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:contain;background:#f0f3f1}figcaption{padding:14px;font-size:13px}figcaption p{margin:6px 0}
      .caption{white-space:pre-wrap;background:#f4f7f5;padding:20px;border-radius:10px}.error{background:#fff0ec;color:#8a2716;border-radius:8px;padding:14px;overflow-wrap:anywhere}.status{font-weight:700}.mono,code{font-family:monospace;overflow-wrap:anywhere;font-size:12px}summary{cursor:pointer;font-weight:600}.history li{margin:12px 0}.login{max-width:500px}
      @media(max-width:900px){.layout{grid-template-columns:1fr}.slides{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}.social{padding:24px 16px}.panel{padding:18px}}
    `}</style></>;
}
