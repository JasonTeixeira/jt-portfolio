import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, detectColumns, scoreRow, rankLeads } from '../../scripts/score-leads.mjs';

const HEADER = ['name', 'site', 'phone', 'email_1', 'rating', 'reviews', 'type', 'city', 'state', 'facebook', 'instagram'];

test('parseCsv handles quoted fields with commas and embedded newlines', () => {
  const rows = parseCsv('a,b,c\n"x, y","line1\nline2",z\n');
  assert.deepEqual(rows[0], ['a', 'b', 'c']);
  assert.deepEqual(rows[1], ['x, y', 'line1\nline2', 'z']);
});

test('parseCsv strips BOM and skips blank rows', () => {
  const rows = parseCsv('\uFEFFa,b\n\n1,2\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2']]);
});

test('detectColumns maps reviews before rating (avoids collision)', () => {
  const map = detectColumns(HEADER);
  assert.equal(map.business, 0);
  assert.equal(map.website, 1);
  assert.equal(map.phone, 2);
  assert.equal(map.email, 3);
  assert.equal(map.rating, 4);
  assert.equal(map.reviews, 5);
  assert.equal(map.category, 6);
});

test('scoreRow disqualifies off-niche businesses', () => {
  const map = detectColumns(HEADER);
  const row = ['Sunrise Bakery', 'https://x.com', '555', 'a@b.com', '4.9', '220', 'Bakery', 'SF', 'CA', '', ''];
  const s = scoreRow(row, map, ['restoration', 'hvac']);
  assert.equal(s.disqualified, 'off-niche');
  assert.equal(s.score, 0);
});

test('scoreRow disqualifies unreachable rows (no phone/site/email)', () => {
  const map = detectColumns(HEADER);
  const row = ['Ghost Restoration', '', '', '', '', '', 'Water damage restoration service', 'Austin', 'TX', '', ''];
  const s = scoreRow(row, map, ['restoration', 'hvac']);
  assert.equal(s.disqualified, 'unreachable');
});

test('scoreRow rewards a full-contact, sweet-spot-review niche match', () => {
  const map = detectColumns(HEADER);
  const row = ['Riverline Restoration', 'https://r.com', '555', 'a@r.com', '4.7', '63', 'Water damage restoration service', 'Chicago', 'IL', 'https://fb.com/r', ''];
  const s = scoreRow(row, map, ['restoration', 'hvac']);
  assert.equal(s.disqualified, null);
  assert.equal(s.niche, 'restoration');
  assert.ok(s.score >= 90, `expected high score, got ${s.score}`);
});

test('scoreRow flags and penalizes a likely chain', () => {
  const map = detectColumns(HEADER);
  const chain = ['Servpro of Downtown', 'https://servpro.com', '555', '', '4.5', '410', 'Water damage restoration service', 'NY', 'NY', '', ''];
  const s = scoreRow(chain, map, ['restoration']);
  assert.ok(s.why.some((w) => /chain\/franchise/.test(w)));
});

test('rankLeads sorts desc and respects topN', () => {
  const rows = [
    HEADER,
    ['Riverline Restoration', 'https://r.com', '555', 'a@r.com', '4.7', '63', 'Water damage restoration', 'Chicago', 'IL', 'https://fb/r', ''],
    ['Bayou Mitigation', 'https://b.com', '555', '', '4.8', '29', 'Fire damage restoration', 'NOLA', 'LA', '', ''],
    ['Sunrise Bakery', 'https://x.com', '555', 'a@b.com', '4.9', '220', 'Bakery', 'SF', 'CA', '', ''],
  ];
  const ranked = rankLeads(rows, ['restoration', 'hvac'], 1);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].business, 'Riverline Restoration'); // full contact beats partial
});
