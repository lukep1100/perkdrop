import {spawn} from 'node:child_process';
// The managed preview forwards Vite-style flags; Next names its host flag differently.
const args=process.argv.slice(2),next=[];
for(let i=0;i<args.length;i++){
  if(args[i]==='--strictPort')continue;
  next.push(args[i]==='--host'?'--hostname':args[i]);
}
if(!next.includes('--hostname'))next.push('--hostname','0.0.0.0');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...next],{stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code||0));
