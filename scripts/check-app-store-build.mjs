import {createPrivateKey,sign} from 'node:crypto';
import {appendFileSync} from 'node:fs';

// The existing App Store Connect credentials stay in the release environment.
// Never print the key, signed token, request headers or Apple response bodies.
function token(){
  const kid=process.env.APP_STORE_CONNECT_API_KEY_ID,issuer=process.env.APP_STORE_CONNECT_ISSUER_ID,pem=process.env.APP_STORE_CONNECT_API_KEY_P8;
  if(!kid||!issuer||!pem)throw Error('Existing App Store Connect release credentials are required.');
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000);
  const unsigned=encode({alg:'ES256',kid,typ:'JWT'})+'.'+encode({iss:issuer,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
  return unsigned+'.'+sign('sha256',Buffer.from(unsigned),{key:createPrivateKey(pem),dsaEncoding:'ieee-p1363'}).toString('base64url');
}
const number=process.env.PERKDROP_BUILD_NUMBER;
if(!/^\d{2,4}$/.test(number||''))throw Error('A validated release build number is required.');
const url=new URL('https://api.appstoreconnect.apple.com/v1/builds');
url.search=new URLSearchParams({'filter[app]':'6820120968','filter[version]':number,limit:'5'}).toString();
async function builds(){
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token()},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Apple build verification failed with HTTP '+response.status+'.');
  const result=await response.json();if(!Array.isArray(result.data))throw Error('Apple returned an invalid build response.');
  return result.data;
}
if(!process.argv.includes('--wait')){
  if((await builds()).length)throw Error('This build number already exists in Apple. Increment mobile/release.json before another upload.');
  console.log('Apple confirmed that candidate build '+number+' is unused.');
}else{
  let accepted=false;
  for(let attempt=0;attempt<30;attempt++){
    const rows=await builds(),build=rows[0],state=build?.attributes?.processingState;
    if(['FAILED','INVALID'].includes(state))throw Error('Apple processing rejected build '+number+'. Check App Store Connect.');
    if(state==='VALID'){
      const summary=`TestFlight build ${number} processed successfully. Build ID: ${build.id}. Physical-iPhone acceptance and App Review remain.\n`;
      console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);accepted=true;break;
    }
    console.log('Waiting for Apple processing of build '+number+' ('+(state||'not indexed yet')+').');
    await new Promise(resolve=>setTimeout(resolve,20000));
  }
  if(!accepted)throw Error('Upload completed, but Apple processing was not confirmed within ten minutes. Inspect App Store Connect before retrying.');
}
