// No side effects at import time. Tests inject a transport; production uses Resend.
type RequestBody = {from:string;to:string[];subject:string;text:string;html:string};
export async function sendRequest(apiKey:string,id:string,body:RequestBody,transport:typeof fetch=fetch){
  try{
    const response=await transport('https://api.resend.com/emails',{
      method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json','idempotency-key':`merchant-notification-${id}`},
      body:JSON.stringify(body),signal:AbortSignal.timeout(15000),
    });
    const payload=await response.json().catch(()=>({}));
    if(response.ok){
      return typeof payload.id==='string'&&payload.id.length>0
        ? {accepted:true as const,providerId:payload.id}
        : {accepted:false as const,retryable:false,uncertain:true,code:'provider_acceptance_missing_id'};
    }
    const retryable=response.status===429||response.status>=500||
      (response.status===409&&payload.name==='concurrent_idempotent_requests');
    return {accepted:false as const,retryable,uncertain:response.status>=500,code:`provider_http_${response.status}`};
  }catch{
    return {accepted:false as const,retryable:true,uncertain:true,code:'provider_network_or_timeout'};
  }
}
export function retryState(attempt:number,firstAttempt:string,now=Date.now()){
  const withinWindow=Number.isFinite(Date.parse(firstAttempt))&&now-Date.parse(firstAttempt)<23*60*60*1000;
  return attempt<5&&withinWindow
    ? {status:'pending',next_attempt_at:new Date(now+Math.min(3600,60*2**(attempt-1))*1000).toISOString()}
    : {status:'delivery_unknown',next_attempt_at:null};
}
// Supabase query builder is injected to exercise persistence failure and concurrency paths.
// deno-lint-ignore no-explicit-any
export async function dispatchMerchantBatch(sb:any,apiKey:string,limit:number,render:(row:any)=>RequestBody,transport:typeof fetch=fetch){
  const {data:rows,error}=await sb.rpc('claim_merchant_notifications',{p_limit:limit});
  if(error)throw new Error('notification_claim_failed');
  const totals={processed:0,provider_accepted:0,requeued:0,failed:0,skipped:0,delivery_unknown:0};
  for(const row of rows||[]){
    // Compare the lease as well as status; an old worker cannot overwrite a newer lease.
    const save=async(patch:Record<string,unknown>)=>{
      const r=await sb.from('merchant_notification_outbox').update(patch).eq('id',row.id)
        .eq('status','processing').eq('attempt_count',row.attempt_count)
        .eq('processing_started_at',row.processing_started_at).select('id');
      if(r.error||r.data?.length!==1)throw new Error('notification_persistence_or_lease_failed');
    };
    const body:RequestBody=row.provider_request||render(row);
    // Freeze exact payload before the first HTTP call. A retry cannot change recipient,
    // template or sender while retaining the provider's idempotency key.
    if(!row.provider_request)await save({provider_request:body});
    const gate=await sb.rpc('merchant_notification_send_allowed',{p_id:row.id});
    if(gate.error)throw new Error('notification_preflight_failed');
    if(!gate.data){
      await save({status:'skipped',last_error:'release_or_business_policy_blocked',processing_started_at:null});
      totals.skipped++;totals.processed++;continue;
    }
    const result=await sendRequest(apiKey,row.id,body,transport);
    if(result.accepted){
      // Do not label an API receipt as server delivery or inbox receipt.
      // If persistence fails, the lease remains recoverable with the SAME request/key.
      await save({status:'provider_accepted',provider_message_id:result.providerId,
        provider_accepted_at:new Date().toISOString(),last_error:null,processing_started_at:null,next_attempt_at:null});
      totals.provider_accepted++;
    }else{
      const next=result.retryable?retryState(row.attempt_count,row.first_attempt_at):
        {status:result.uncertain?'delivery_unknown':'failed',next_attempt_at:null};
      await save({...next,last_error:result.code,processing_started_at:null});
      if(next.status==='pending')totals.requeued++;
      else if(next.status==='delivery_unknown')totals.delivery_unknown++;
      else totals.failed++;
    }
    totals.processed++;
  }
  return totals;
}
