import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Cache-Control':'no-store'
};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'}});
const clean=(v:any,max=1800)=>String(v??'').trim().slice(0,max);
const safeHttps=(v:any)=>{const s=clean(v);if(!s)return null;try{const u=new URL(s);return u.protocol==='https:'?u.toString():null}catch{return null}};
const MAX_BYTES=8*1024*1024;
const MIME_TO_EXT:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(!['GET','POST'].includes(req.method))return json({ok:false,error:'method_not_allowed'},405);
  try{
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const auth=req.headers.get('authorization')||'',token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';
    if(!token)return json({ok:false,error:'unauthorized'},401);
    const {data:ud,error:ue}=await sb.auth.getUser(token);const user=ud.user;if(ue||!user)return json({ok:false,error:'unauthorized'},401);

    let merchantId='',body:any=null,form:FormData|null=null,action='';
    const contentType=req.headers.get('content-type')||'';
    if(req.method==='GET'){
      merchantId=clean(new URL(req.url).searchParams.get('merchant_id'),80);
    }else if(contentType.includes('multipart/form-data')){
      form=await req.formData();
      merchantId=clean(form.get('merchant_id'),80);
      action=clean(form.get('action'),80)||'upload_image';
    }else{
      body=await req.json().catch(()=>null);
      merchantId=clean(body?.merchant_id,80);
      action=clean(body?.action,80);
    }
    if(!merchantId)return json({ok:false,error:'merchant_id_required'},400);

    const {data:member}=await sb.from('merchant_members').select('role,status').eq('merchant_id',merchantId).eq('user_id',user.id).eq('status','active').maybeSingle();
    if(!member||!['owner','admin','editor'].includes(member.role))return json({ok:false,error:'merchant_access_denied'},403);

    if(req.method==='GET'){
      const {data:m,error}=await sb.from('merchants').select('id,name,logo_url,hero_image_url,image_candidate_url,image_candidate_source_url,image_rights_status,media_rights_confirmed').eq('id',merchantId).single();
      if(error)return json({ok:false,error:'merchant_load_failed'},500);return json({ok:true,merchant:m});
    }

    if(action==='upload_image'){
      if(!form)return json({ok:false,error:'multipart_required'},400);
      const confirmRights=String(form.get('confirm_rights')||'').toLowerCase()==='true';
      if(!confirmRights)return json({ok:false,error:'rights_confirmation_required'},400);
      const kindRaw=clean(form.get('kind'),30).toLowerCase();
      const kind=['hero','logo','offer'].includes(kindRaw)?kindRaw:'offer';
      const file=form.get('file');
      if(!(file instanceof File)||file.size<1)return json({ok:false,error:'image_file_required'},400);
      if(file.size>MAX_BYTES)return json({ok:false,error:'image_too_large_max_8mb'},413);
      const ext=MIME_TO_EXT[file.type];
      if(!ext)return json({ok:false,error:'image_type_not_allowed'},415);
      const path=`${merchantId}/${kind}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await sb.storage.from('merchant-media').upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});
      if(uploadError){console.error(uploadError);return json({ok:false,error:'image_upload_failed'},500)}
      const {data:pub}=sb.storage.from('merchant-media').getPublicUrl(path);
      const url=pub.publicUrl;
      const {data:m}=await sb.from('merchants').select('metadata').eq('id',merchantId).single();
      const metadata={...(m?.metadata||{}),last_media_authorised_by_user:user.id,last_media_authorised_at:new Date().toISOString(),last_media_authorisation_basis:'merchant_uploaded'};
      if(kind==='hero'){
        await sb.from('merchants').update({hero_image_url:url,image_candidate_url:url,image_candidate_source_url:url,image_rights_status:'merchant_authorised',media_rights_confirmed:true,metadata}).eq('id',merchantId);
      }else if(kind==='logo'){
        await sb.from('merchants').update({logo_url:url,media_rights_confirmed:true,metadata}).eq('id',merchantId);
      }else{
        await sb.from('merchants').update({media_rights_confirmed:true,metadata}).eq('id',merchantId);
      }
      return json({ok:true,url,path,kind},201);
    }

    if(action==='authorize_candidate'){
      if(body?.confirm_rights!==true)return json({ok:false,error:'rights_confirmation_required'},400);
      const {data:m}=await sb.from('merchants').select('image_candidate_url,image_candidate_source_url,metadata').eq('id',merchantId).single();
      if(!m?.image_candidate_url)return json({ok:false,error:'no_image_candidate'},404);
      const metadata={...(m.metadata||{}),image_authorised_by_user:user.id,image_authorised_at:new Date().toISOString(),image_authorisation_basis:'merchant_confirmed_rights'};
      const {data,error}=await sb.from('merchants').update({hero_image_url:m.image_candidate_url,image_rights_status:'merchant_authorised',media_rights_confirmed:true,metadata}).eq('id',merchantId).select('id,name,hero_image_url,image_rights_status,media_rights_confirmed').single();
      if(error)return json({ok:false,error:'image_authorise_failed'},500);return json({ok:true,merchant:data});
    }

    if(action==='set_image'){
      if(body?.confirm_rights!==true)return json({ok:false,error:'rights_confirmation_required'},400);
      const image=safeHttps(body?.image_url);if(!image)return json({ok:false,error:'valid_https_image_required'},400);
      const {data:m}=await sb.from('merchants').select('metadata').eq('id',merchantId).single();
      const metadata={...(m?.metadata||{}),image_authorised_by_user:user.id,image_authorised_at:new Date().toISOString(),image_authorisation_basis:'merchant_supplied_or_authorised'};
      const {data,error}=await sb.from('merchants').update({hero_image_url:image,image_candidate_url:image,image_candidate_source_url:image,image_rights_status:'merchant_authorised',media_rights_confirmed:true,metadata}).eq('id',merchantId).select('id,name,hero_image_url,image_rights_status,media_rights_confirmed').single();
      if(error)return json({ok:false,error:'image_update_failed'},500);return json({ok:true,merchant:data});
    }

    if(action==='remove_public_image'){
      const {data:m}=await sb.from('merchants').select('image_candidate_url').eq('id',merchantId).single();
      const {data,error}=await sb.from('merchants').update({hero_image_url:null,media_rights_confirmed:false,image_rights_status:m?.image_candidate_url?'candidate':'missing'}).eq('id',merchantId).select('id,name,hero_image_url,image_rights_status').single();
      if(error)return json({ok:false,error:'image_remove_failed'},500);return json({ok:true,merchant:data});
    }

    return json({ok:false,error:'unknown_action'},400);
  }catch(e){console.error(e);return json({ok:false,error:'merchant_media_failed'},500)}
});
