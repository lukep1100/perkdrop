import {readFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function releaseConfig(manifest,app,overrides={}) {
  if(manifest.channel!=='testflight'||manifest.version!==app.expo?.version||app.expo?.ios?.bundleIdentifier!=='au.perkdrop.app')throw Error('Release must match the PerkDrop app and target TestFlight.');
  const buildNumber=String(overrides.buildNumber??manifest.buildNumber);
  if(!/^[1-9]\d{1,3}$/.test(buildNumber)||Number(buildNumber)<12)throw Error('Choose an unused numeric build number from 12 to 9999.');
  const pushEnabled=overrides.pushEnabled??manifest.pushEnabled;
  if(typeof pushEnabled!=='boolean')throw Error('Push mode must be an explicit boolean.');
  return {version:manifest.version,buildNumber,pushEnabled};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const manifest=JSON.parse(readFileSync(new URL('../mobile/release.json',import.meta.url))),app=JSON.parse(readFileSync(new URL('../mobile/app.json',import.meta.url)));
  const manual=process.env.GITHUB_EVENT_NAME==='workflow_dispatch';
  const config=releaseConfig(manifest,app,manual?{buildNumber:process.env.PERKDROP_RELEASE_BUILD_INPUT,pushEnabled:process.env.PERKDROP_RELEASE_PUSH_INPUT==='true'}:{});
  if(process.env.GITHUB_ENV&&!process.argv.includes('--check'))appendFileSync(process.env.GITHUB_ENV,`PERKDROP_BUILD_NUMBER=${config.buildNumber}\nEXPO_PUBLIC_BUILD_NUMBER=${config.buildNumber}\nEXPO_PUBLIC_PUSH_ENABLED=${config.pushEnabled}\n`);
  console.log(`TestFlight candidate ${config.version} (${config.buildNumber}); opt-in push ${config.pushEnabled?'enabled':'disabled'}. App Review remains a separate release step.`);
}
