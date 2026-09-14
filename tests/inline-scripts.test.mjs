import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Type-checking a TS template does not parse the JavaScript sent to browsers.
for (const name of ['perkdrop-portal', 'perkdrop-booking-page']) {
  test(`${name}: rendered inline JavaScript parses`, async () => {
    const source = await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
    const template = source.match(/const (?:HTML|PAGE)\s*=\s*((?:String.raw)?`[^]*?`);/);
    assert.ok(template, 'expected an HTML template');
    assert.ok(!template[1].includes('${'), 'review new server-side template interpolation before executing it in the test');
    const html = vm.runInNewContext(template[1], {}, {timeout: 1000}).replace('__ATTR_JSON__', '{}');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([^]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
    assert.ok(scripts.length > 0, 'expected inline JavaScript');
    scripts.forEach((code, index) => new vm.Script(code, {filename: `${name}-inline-${index}.js`}));
  });
}
