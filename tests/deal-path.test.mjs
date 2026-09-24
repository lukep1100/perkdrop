import test from 'node:test';
import assert from 'node:assert/strict';
import {dealPath} from '../supabase/functions/_shared/deal-path.mjs';

test('deal paths are canonical first-party routes only',()=>{
  assert.equal(dealPath('union-hotel-lunch'),'/deals/union-hotel-lunch');
  assert.equal(dealPath('north_adelaide_2026'),'/deals/north_adelaide_2026');
  for(const value of ['', '/\\evil.example', '//evil.example', 'deal?next=https://evil.example', 'deal/path', 'deal%2fpath', 'Deal'])assert.equal(dealPath(value),null);
});
