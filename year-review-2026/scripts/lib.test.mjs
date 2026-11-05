import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, shortTitle, bboxOf, wrapLng, validatePoints, isRegional } from './lib.mjs';

test('parseDate handles ISO and Chinese formats', () => {
  assert.equal(parseDate('2026-04-25'), '2026-04-25');
  assert.equal(parseDate('2026年4月25日'), '2026-04-25');
  assert.equal(parseDate('garbage'), null);
  assert.equal(parseDate('2026-13-01'), null);
});
test('shortTitle strips trailing dates', () => {
  assert.equal(shortTitle('馬利戰情地圖'), '馬利戰情地圖');
  assert.equal(shortTitle('尼日士兵譁變・尼亞美・2026-08-29'), '尼日士兵譁變・尼亞美');
  assert.equal(shortTitle('紅利曼市區攻防態勢（2026年6月19日）'), '紅利曼市區攻防態勢');
});
test('antimeridian coordinates are kept and wrapped for anchors', () => {
  const b = bboxOf([[52.7, 174.1], [61.2, 210.2]]);
  assert.deepEqual(b, [[52.7, 174.1], [61.2, 210.2]]);
  assert.ok(Math.abs(wrapLng(210.2) - -149.8) < 1e-9);
  assert.equal(validatePoints([[0, 210.2]]).length, 0);
  assert.equal(validatePoints([[91, 0]]).length, 1);
});
test('isRegional flags continental extents', () => {
  assert.equal(isRegional([[40, 40], [50, 60]]), false);
  assert.equal(isRegional([[24, 40], [56, 120]]), true);
});
