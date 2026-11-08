import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function testEventWatchMaintenance(pool, check) {
  // Minimal inspected production columns, only in the runner's disposable cluster.
  await pool.query(`
    create schema if not exists perkdrop_private;
    create table event_watch_runs (
      id bigint generated always as identity primary key, started_at timestamptz not null default now(),
      finished_at timestamptz, sources_checked integer not null default 0,
      sources_changed integer not null default 0, events_detected integer not null default 0,
      candidates_created integer not null default 0, auto_published integer not null default 0,
      failures integer not null default 0, details jsonb not null default '{}'
    );
    create table deal_candidates (
      id bigint generated always as identity, candidate_type text, status text,
      starts_at timestamptz, ends_at timestamptz, reviewed_at timestamptz,
      updated_at timestamptz, metadata jsonb not null default '{}'
    );
    create table merchant_sources (
      id bigint generated always as identity, purpose text, monitoring_enabled boolean,
      authoritative boolean default true, last_http_status integer, consecutive_failures integer,
      updated_at timestamptz, next_check_at timestamptz, metadata jsonb not null default '{}'
    );
  `);
  await pool.query(await readFile(new URL('../../supabase/migrations/20261108040558_event_watch_stalled_run_guard.sql', import.meta.url), 'utf8'));
  const addRun = async (hours, details, progress = {}) => (await pool.query(`
    insert into event_watch_runs(started_at, details, sources_checked, sources_changed,
      events_detected, candidates_created, auto_published)
    values(now()-$1*interval '1 hour',$2,$3,$4,$5,$6,$7) returning id`,
  [hours, details, ...['sources_checked', 'sources_changed', 'events_detected', 'candidates_created', 'auto_published'].map(key => progress[key] || 0)])).rows[0].id;
  const machine = await addRun(3, { version: 3, status: 'running', source_marker: 'preserved' });
  const editorial = await addRun(25, { version: 5, scope: 'national_editorial_cycle', status: 'running' });
  const protectedIds = [
    await addRun(1, { version: 3 }),
    await addRun(23, { version: 5, scope: 'national_editorial_cycle' }),
    await addRun(50, { version: 5, scope: 'other_work' }),
    await addRun(50, { version: 99 }),
  ];
  for (const field of ['sources_checked', 'sources_changed', 'events_detected', 'candidates_created', 'auto_published']) {
    protectedIds.push(await addRun(50, { version: 3 }, { [field]: 1 }));
  }
  const success = await addRun(4, { version: 3 });
  await pool.query("update event_watch_runs set finished_at=now()-interval '1 hour' where id=$1", [success]);
  await pool.query(`
    insert into deal_candidates(candidate_type,status,ends_at) values
      ('event','new',now()-interval '7 hours'),('event','new',now()-interval '5 hours');
    insert into merchant_sources(purpose,monitoring_enabled,last_http_status,consecutive_failures)
      values('deal_monitoring',true,404,3),('deal_monitoring',true,403,9),('deal_monitoring',true,404,2);
  `);
  await check('maintenance closes only empty timed-out known jobs and preserves unknown outcomes', async () => {
    const result = (await pool.query('select perkdrop_private.maintain_event_watch() as value')).rows[0].value;
    assert.equal(result.stalled_runs, 2);
    const rows = (await pool.query('select * from event_watch_runs where id=any($1) order by id', [[machine, editorial]])).rows;
    for (const row of rows) {
      assert.ok(row.finished_at);
      assert.equal(row.failures, 1);
      assert.equal(row.details.status, 'stalled');
      assert.equal(row.details.outcome, 'unknown');
      assert.equal(row.details.closure_reason, 'maintenance_timeout');
    }
    assert.equal(rows[0].details.source_marker, 'preserved');
    assert.equal(rows[0].details.timeout_hours, 2);
    assert.equal(rows[1].details.timeout_hours, 24);
    assert.equal((await pool.query('select count(*) from event_watch_runs where id=any($1) and finished_at is null', [protectedIds])).rows[0].count, String(protectedIds.length));
  });
  await check('maintenance retains expiry/dead-source rules and is idempotent', async () => {
    const candidates = (await pool.query('select status from deal_candidates order by id')).rows;
    assert.deepEqual(candidates.map(row => row.status), ['expired', 'new']);
    assert.deepEqual((await pool.query('select monitoring_enabled from merchant_sources order by id')).rows.map(row => row.monitoring_enabled), [false, true, true]);
    assert.equal((await pool.query('select perkdrop_private.maintain_event_watch() as value')).rows[0].value.stalled_runs, 0);
    assert.equal((await pool.query('select failures from event_watch_runs where id=$1', [machine])).rows[0].failures, 1);
  });
  await check('stalled closure never refreshes successful-run health; maintenance stays private', async () => {
    const expected = (await pool.query('select finished_at from event_watch_runs where id=$1', [success])).rows[0].finished_at;
    assert.equal((await pool.query('select last_completed_run from perkdrop_private.event_autopilot_health')).rows[0].last_completed_run.toISOString(), expected.toISOString());
    const security = (await pool.query(`select prosecdef,has_function_privilege('anon',oid,'execute') as anon,
      has_function_privilege('authenticated',oid,'execute') as authenticated,
      has_function_privilege('service_role',oid,'execute') as service_role
      from pg_proc where oid='perkdrop_private.maintain_event_watch()'::regprocedure`)).rows[0];
    assert.deepEqual(security, { prosecdef: false, anon: false, authenticated: false, service_role: false });
  });
}
