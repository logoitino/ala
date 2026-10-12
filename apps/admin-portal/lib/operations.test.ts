import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOperations, type OperationsInput } from './operations.ts';

const base: OperationsInput = {
  tabs: [
    { label: 'Home', value: 40 },
    { label: 'Profile', value: 10 },
  ],
  buttons: [
    { label: 'Donate', value: 8 },
    { label: 'Seki', value: 3 },
  ],
  appErrors: [{ label: 'Playback stall', value: 2 }],
  portalErrors: [],
  usage: { sessions_24h: 12 },
  reliability: { stalls_24h: 2 },
  published: { tabs: { home: true, drip: false } },
};

test('names the busiest place and the most used button', () => {
  const lenses = buildOperations(base);
  assert.equal(lenses[0]?.summary, 'Home is where people spend the most time.');
  assert.equal(lenses[1]?.summary, 'Donate is the button people use the most.');
  assert.equal(lenses[2]?.summary, 'Playback stall is the most reported app error.');
});

test('a portal failure leads the errors tab', () => {
  const errors = buildOperations({ ...base, portalErrors: ['Reports did not load. missing'] }).find((lens) => lens.id === 'errors');
  assert.match(errors?.summary ?? '', /portal could not load/);
  assert.equal(errors?.details[0]?.label, 'Portal');
});

test('menus count what is on', () => {
  const menus = buildOperations(base).find((lens) => lens.id === 'menus');
  assert.match(menus?.summary ?? '', /menus are on/);
  assert.ok((menus?.details.length ?? 0) > 4);
});
