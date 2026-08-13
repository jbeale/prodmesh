import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.PRODMESH_DATA_DIR = mkdtempSync(join(tmpdir(), 'prodmesh-showcfg-'));
const cfg = await import('./showConfig.js');

test('config round-trips per (room, plan)', () => {
  assert.equal(cfg.getConfig('r1', 'p1'), null);
  cfg.setConfig('r1', 'p1', {
    startItemId: 'worship',
    endItemId: 'closing',
    map: { worship: { ppIndex: 4, ppName: 'Call To Worship' }, skipped: null },
  });
  const got = cfg.getConfig('r1', 'p1');
  assert.equal(got.startItemId, 'worship');
  assert.equal(got.endItemId, 'closing');
  assert.deepEqual(got.map, { worship: { ppIndex: 4, ppName: 'Call To Worship' } });
  assert.equal(cfg.getConfig('r1', 'p2'), null); // other events untouched

  cfg.setConfig('r1', 'p1', { startItemId: null, endItemId: 'closing' }); // update
  assert.equal(cfg.getConfig('r1', 'p1').startItemId, null);

  cfg.clearConfig('r1', 'p1');
  assert.equal(cfg.getConfig('r1', 'p1'), null);
});

test('validation rejects bad shapes', () => {
  assert.throws(() => cfg.setConfig('r', 'p', 'nope'), /object/);
  assert.throws(() => cfg.setConfig('r', 'p', { startItemId: 5 }), /item id/);
  assert.throws(() => cfg.setConfig('r', 'p', { map: { a: { ppIndex: 'x' } } }), /ppIndex/);
  assert.throws(() => cfg.setConfig('r', 'p', { map: { a: { ppIndex: -1 } } }), /ppIndex/);
});

test('Services LIVE can be armed independently of Run of Show', () => {
  const saved = cfg.setConfig('r-live', 'p-live', {
    servicesLiveFromProPresenter: true,
    servicesLiveStartMode: 'service-time',
    servicesLiveStartTimeId: 'time-9am',
  });
  assert.equal(saved.servicesLiveFromProPresenter, true);
  assert.equal(saved.servicesLiveStartMode, 'service-time');
  assert.equal(saved.servicesLiveStartTimeId, 'time-9am');
  assert.equal(saved.startItemId, null, 'Run of Show remains optional');
});
