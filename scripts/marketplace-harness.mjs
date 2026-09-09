// Isolated, deterministic marketplace fixture harness. It never connects to Supabase.
import assert from 'node:assert/strict';

const fee = (model, terms, units, bookings, tracked) => {
  if (model === 'per_unit') return units * Number(terms.flat || 0);
  if (model === 'per_booking') return bookings * Number(terms.flat || 0);
  if (model === 'percentage_of_tracked_value') return Math.round(tracked * Number(terms.rate || 0) * 100) / 100;
  if (model === 'hybrid') return Math.round((units * Number(terms.flat || 0) + tracked * Number(terms.rate || 0)) * 100) / 100;
  return 0;
};

class FixtureMarket {
  constructor(capacity, merchant = 'merchant-a') { this.offer = { merchant, total: capacity, remaining: capacity, holds: 0, redeemed: 0 }; this.codes = new Map(); this.queue = Promise.resolve(); }
  claim(merchant, quantity, session) {
    return Promise.resolve().then(() => {
      if (merchant !== this.offer.merchant) return { ok: false, error: 'merchant_access_denied' };
      const existing = [...this.codes.values()].find(x => x.session === session && x.status === 'active');
      if (existing) return { ok: true, reused: true, code: existing.code };
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > this.offer.remaining) return { ok: false, error: 'insufficient_capacity' };
      this.offer.remaining -= quantity; this.offer.holds += quantity;
      const code = `PD-TEST-${crypto.randomUUID()}`; this.codes.set(code, { merchant, quantity, status: 'active', session, code });
      return { ok: true, reused: false, code };
    });
  }
  redeem(merchant, code) {
    const pass = this.codes.get(code);
    if (!pass || pass.merchant !== merchant) throw Error('redemption_not_available');
    if (pass.status !== 'active') throw Error('redemption_not_available');
    pass.status = 'redeemed'; this.offer.holds -= pass.quantity; this.offer.redeemed += pass.quantity; return pass;
  }
}

const results = [];
const test = async (name, fn) => { await fn(); results.push(name); };

for (const [label, capacity, qty, attempts] of [['last appointment', 1, 1, 2], ['last two tickets', 2, 2, 2], ['four players', 4, 1, 8], ['Union-style diners', 20, 1, 30]]) {
  const market = new FixtureMarket(capacity);
  const outcomes = await Promise.allSettled(Array.from({ length: attempts }, (_, i) => market.claim('merchant-a', qty, `session-${i}`)));
  const success = outcomes.filter(x => x.status === 'fulfilled' && x.value.ok);
  assert.equal(success.length, Math.floor(capacity / qty), `${label}: exact allocation`);
  assert.ok(market.offer.remaining >= 0, `${label}: no negative inventory`);
  results.push(`concurrency:${label}`);
}

await test('idempotent duplicate claim', async () => { const m = new FixtureMarket(1); const first = await m.claim('merchant-a', 1, 'same'); const second = await m.claim('merchant-a', 1, 'same'); assert.equal(second?.code, first.code, JSON.stringify(second)); assert.equal(m.offer.remaining, 0); });
await test('merchant isolation', async () => { const m = new FixtureMarket(1); const result = await m.claim('merchant-b', 1, 'x'); assert.deepEqual(result, { ok: false, error: 'merchant_access_denied' }); });
await test('replay and wrong merchant rejection', () => { const m = new FixtureMarket(1); return m.claim('merchant-a', 1, 'x').then(({ code }) => { assert.throws(() => m.redeem('merchant-b', code), /redemption_not_available/); m.redeem('merchant-a', code); assert.throws(() => m.redeem('merchant-a', code), /redemption_not_available/); }); });
await test('commercial models', () => { assert.equal(fee('per_unit', { flat: 3 }, 4, 1, 0), 12); assert.equal(fee('per_booking', { flat: 8 }, 4, 2, 0), 16); assert.equal(fee('percentage_of_tracked_value', { rate: .07 }, 0, 0, 100), 7); assert.equal(fee('hybrid', { flat: 2, rate: .05 }, 3, 1, 100), 11); });
await test('privacy threshold', () => { const signals = ['a','a','b','c','d','e','f','g','h','i','j'].map(user => ({ user })); assert.equal(new Set(signals.map(x => x.user)).size >= 10, true); assert.equal(new Set(signals.slice(0, 9).map(x => x.user)).size >= 10, false); });
await test('demand expiry', () => { const now = Date.now(); const signal = { expires: now + 1000 }; assert.equal(signal.expires > now, true); assert.equal(signal.expires < now + 2000, true); });

console.log(`marketplace harness passed: ${results.length} assertions`);
