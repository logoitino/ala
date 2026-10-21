/**
 * Tests for `lib/eventLabels.ts`: the one source of people words for telemetry keys on Health,
 * Trends, Analytics and Departments. They pin the VISUAL_QA 2026-10-12 examples, the VOICE rule
 * that money keys read as "Donate" / "donation", the readable fallback for unknown keys, and
 * that rows with the same words merge.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { featureLabel, issueLabel, labelRows, readableKey, surfaceLabel } from './eventLabels.ts';

/** A raw key looks like code: a dot between letters, an underscore, or the " · " join. */
const looksLikeKey = (text: string) => /[A-Za-z]\.[A-Za-z]|_| · /.test(text);

test('feature keys from the review read as people words', () => {
  assert.equal(featureLabel('reel.seki'), 'Seki on a Highlight');
  assert.equal(featureLabel('hype.aura'), 'Aura on a Highlight');
  assert.equal(featureLabel('crew.follow'), 'Join Crew');
  assert.equal(featureLabel('crew.join'), 'Join Crew');
  assert.equal(featureLabel('spotlight.open_modal'), 'Open Spotlight');
  assert.equal(featureLabel('reel.save'), 'Save a Highlight');
  assert.equal(featureLabel('poll.vote'), 'Cheer poll vote');
  assert.equal(featureLabel('share_qr.copy'), 'Copy the QR donation link');
  assert.equal(featureLabel('  '), 'Unknown button');
});

test('issue keys read as what went wrong, with the surface in brackets', () => {
  assert.equal(issueLabel('upload.retry · upload'), 'Upload retry (upload)');
  assert.equal(issueLabel('malo.sheet.dismiss_error · home'), 'Donate sheet closed with an error (Home)');
  assert.equal(issueLabel('video.stall_overlay · spotlight'), 'Video stalled (Spotlight)');
  assert.equal(issueLabel('poll.vote_timeout · local'), 'Cheer poll vote timed out (Local)');
  assert.equal(issueLabel('checkout · app'), 'Donation checkout error (app)');
  assert.equal(issueLabel('control · app'), 'Unnamed control (app)');
  // Open bug reports arrive as "<surface> bug".
  assert.equal(issueLabel('profile bug'), 'Open bug reports (Profile)');
  assert.equal(issueLabel('checkout bug'), 'Open bug reports (checkout)');
  assert.equal(issueLabel(''), 'Unknown issue');
});

test('money keys say Donate or donation, never Mālo or tip (VOICE.md)', () => {
  const money = [
    featureLabel('malo'),
    featureLabel('reel.malo.open'),
    featureLabel('malo.sheet.unknown_step'),
    featureLabel('tips.history'),
    issueLabel('malo.sheet.dismiss_error · home'),
    issueLabel('received_malo_unavailable · profile'),
    issueLabel('tip.sheet.fail · home'),
    readableKey('malo_tip'),
  ];
  for (const label of money) {
    assert.ok(!/m[aā]lo/i.test(label), `${label} has no Mālo`);
    assert.ok(!/\btips?\b/i.test(label), `${label} has no tip`);
    assert.match(label, /[Dd]onat/);
  }
});

test('unknown keys are spelled out in sentence case, never shown as the raw key', () => {
  assert.equal(featureLabel('vault.subscribe.sheet'), 'Open Vault subscribe');
  assert.equal(featureLabel('lineup.share_card'), 'Lineup share card');
  assert.equal(featureLabel('clip.flex'), 'Flex on a Highlight');
  assert.equal(issueLabel('lineup.load_fail · drip'), 'Lineup load fail (Drip)');
  assert.equal(issueLabel('odd_thing'), 'Odd thing');
  assert.equal(surfaceLabel('game_day'), 'game day');
  for (const key of ['a.b.c', 'some_new.key', 'x.y_z · new_place', 'new_place bug']) {
    const label = key.includes(' · ') || key.endsWith(' bug') ? issueLabel(key) : featureLabel(key);
    assert.ok(!looksLikeKey(label), `${key} -> ${label}`);
    assert.match(label, /^[A-Z]/);
  }
});

test('labelRows names each row, merges rows with the same words, and sorts largest first', () => {
  const input = [
    { label: 'crew.join', value: 2 },
    { label: 'reel.seki', value: 5 },
    { label: 'crew.follow', value: 4 },
  ];
  assert.deepEqual(labelRows(input, featureLabel), [
    { label: 'Join Crew', value: 6 },
    { label: 'Seki on a Highlight', value: 5 },
  ]);
  assert.deepEqual(input[0], { label: 'crew.join', value: 2 }, 'input is not changed');
  assert.deepEqual(labelRows([], issueLabel), []);
});

test('trivia funnel steps, failures and the quiz surface read as words', () => {
  assert.equal(featureLabel('trivia.view_prep'), 'View trivia preparation');
  assert.equal(featureLabel('trivia.press_start'), 'Tap Start on a trivia round');
  assert.equal(featureLabel('trivia.start'), 'Start a trivia round');
  assert.equal(featureLabel('trivia.answer'), 'Answer a trivia question');
  assert.equal(featureLabel('trivia.next'), 'Next trivia question');
  assert.equal(featureLabel('trivia.complete'), 'Finish a trivia round');
  assert.equal(featureLabel('trivia.abandon'), 'Leave a trivia round');
  assert.equal(featureLabel('trivia.unavailable'), 'Trivia question unavailable');
  assert.equal(issueLabel('trivia.start_failed'), 'Trivia Start failed');
  assert.equal(issueLabel('trivia.answer_failed'), 'Trivia answer failed');
  assert.equal(issueLabel('trivia.next_failed'), 'Trivia Next failed');
  assert.equal(issueLabel('trivia.explanation_failed'), 'Trivia explanation failed');
  assert.equal(surfaceLabel('sport-quiz'), 'Sport Pop Quiz');
  assert.equal(readableKey('trivia.mystery_step'), 'Trivia mystery step');
});
