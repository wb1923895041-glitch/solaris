import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Ajv from 'ajv';

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const validate = new Ajv({ strict: true }).compile(read('schemas/ephemeris-state.schema.json'));
// Synthetic boundary fixture, not a scientific sample. Never shipped to the application.
const fixture = {
  kind: 'ephemeris', targetId: 'synthetic-test', centerId: '0', frame: 'ICRF', referencePlane: 'FRAME', correction: 'NONE',
  epoch: { value: 0, unit: 's', scale: 'TDB', origin: 'J2000_TDB' },
  position: { value: [1, 2, 3], unit: 'km' }, velocity: { value: [0, 0, 0], unit: 'km/s' },
  coverage: { startTdbSeconds: -1, endTdbSeconds: 1, unit: 's' },
  source: { sourceId: 'synthetic-test', url: 'https://example.invalid/fixture', retrievedAtUtc: '2026-10-29T00:00:00Z', version: 'test-only', sha256: '0'.repeat(64), processing: [] }
};
let count = 0;
function check(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
check('complete structural fixture accepted (not scientific validation)', () => assert.equal(validate(fixture), true));
for (const [name, mutate] of [
  ['AU supplied as canonical km', s => s.position.unit = 'au'],
  ['UTC supplied as TDB', s => s.epoch.scale = 'UTC'],
  ['planet center supplied as SSB', s => s.centerId = '399'],
  ['ecliptic supplied as ICRF plane', s => s.referencePlane = 'ECLIPTIC'],
  ['apparent supplied as geometric', s => s.correction = 'LT'],
  ['missing provenance', s => delete s.source],
  ['missing data version', s => delete s.source.version],
  ['invalid hash', s => s.source.sha256 = 'unknown'],
  ['two-dimensional vector', s => s.position.value.pop()],
  ['nonfinite component', s => s.velocity.value[0] = Infinity],
  ['hypothetical experiment entering ephemeris', s => s.kind = 'hypothetical-experiment'],
  ['legacy fate field entering scientific state', s => s.destiny = 'test']
]) {
  check(`reject ${name}`, () => { const s = structuredClone(fixture); mutate(s); assert.equal(validate(s), false); });
}
check('reference PNG bytes unchanged', () => {
  for (const ref of read('data/reference-manifest.json')) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(ref.path)).digest('hex'), ref.sha256);
    assert.equal(ref.runtimeAllowed, false); assert.equal(ref.textureExtractionAllowed, false);
  }
});
check('approved assets have a local file and provenance; planned assets remain absent', () => {
  const assets = read('data/asset-manifest.json'); assert.equal(assets.formalAssetCount, assets.entries.filter(a=>a.approved).length);
  assert.equal(new Set(assets.entries.map(a => a.id)).size, assets.entries.length);
  for (const a of assets.entries) {
    if(a.approved){assert.ok(fs.existsSync(a.localPath));assert.ok(a.productUrl&&a.licenseUrl&&a.credit&&a.version);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.localPath)).digest('hex'),a.sourceSha256);}
    else assert.equal(a.localPath,null);
  }
});
console.log(`${count} contract checks passed. No ephemeris accuracy tested.`);
