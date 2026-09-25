export function nextSourceCheck({failures=0,status=200,intervalMinutes=15,now=Date.now()}={}){
 const base=Math.max(15,Number(intervalMinutes)||15);
 const minutes=failures>0?Math.min(1440,Math.max([401,403,404,410].includes(status)?360:base,base*2**Math.min(10,failures))):base;
 return new Date(now+minutes*60000).toISOString();
}
