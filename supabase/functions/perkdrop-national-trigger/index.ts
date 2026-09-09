import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(()=>new Response(JSON.stringify({ok:false,retired:true,service:'perkdrop-national-trigger'}),{status:410,headers:{'content-type':'application/json','cache-control':'no-store'}}));
