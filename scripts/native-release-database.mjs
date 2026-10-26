import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
// Extend the existing disposable Postgres harness, preserving its isolation and cleanup.
// This script accepts no connection string and never connects to production.
const source=await readFile(new URL('./database-integration.mjs',import.meta.url),'utf8');
const marker="  console.log(`REAL DATABASE: ${count} checks passed. No production connection or fixture writes.`);";
assert.equal(source.split(marker).length,2,'Database harness marker changed; review the extension before running.');
const instrumented=source.replace(marker,"  const {runMobileReleaseChecks}=await import('../tests/database/mobile-release.mjs');\n  await runMobileReleaseChecks(pool,check);\n"+marker);
const temp=new URL('./.native-database-'+randomUUID()+'.mjs',import.meta.url);
try{await writeFile(temp,instrumented,{flag:'wx'});await import(temp.href);}finally{await rm(temp,{force:true});}
