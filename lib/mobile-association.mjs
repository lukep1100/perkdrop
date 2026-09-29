const BUNDLE = 'au.perkdrop.app';
export function appleAssociation(env = {}) {
  const prefix=String(env.PERKDROP_APPLE_APP_ID_PREFIX || '').trim();
  if(!/^[A-Z0-9]{10}$/.test(prefix))return {ready:false,document:{applinks:{details:[]}}};
  return {ready:true,document:{applinks:{details:[{appIDs:[prefix+'.'+BUNDLE],components:[{'/':'/deals/*',comment:'Open a public PerkDrop listing. Private device and account links remain on the web.'}]}]}}};
}
export function androidAssociation(env = {}) {
  const input=String(env.PERKDROP_ANDROID_APP_SIGNING_SHA256 || '').trim();
  const fingerprints=input?input.split(',').map(v=>v.trim().toUpperCase()):[];
  if(!fingerprints.length||fingerprints.some(v=>!/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(v)))return {ready:false,document:[]};
  return {ready:true,document:[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:BUNDLE,sha256_cert_fingerprints:[...new Set(fingerprints)]}}]};
}
