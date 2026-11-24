/** Long explanatory copy collapses behind More/Less without hiding anything from screen readers. */
import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MoreText } from '@/components/UI/MoreText';

const LONG = 'New connected account updates appear here. Your gift history and invitations stay in their own sections.';

describe('MoreText', () => {
  it('shows short text as-is with no toggle', async () => {
    await render(<MoreText>Live matches and polls.</MoreText>);
    expect(screen.getByText('Live matches and polls.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('clamps long text, keeps the full text for screen readers, and toggles More / Less', async () => {
    await render(<MoreText lines={2}>{LONG}</MoreText>);
    const body = screen.getByLabelText(LONG);
    expect(body.props.numberOfLines).toBe(2);
    const toggle = screen.getByRole('button', { name: 'Show more' });
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });

    await fireEvent.press(toggle);
    expect(screen.getByLabelText(LONG).props.numberOfLines).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Show less' }).props.accessibilityState).toEqual({ expanded: true });
  });

  it('allows more collapsed lines for longer budgets', async () => {
    await render(<MoreText lines={3}>{LONG}</MoreText>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('MoreText edges', () => {
  it('needs more than lines × 44 characters before it offers a toggle, after trimming', async () => {
    const exact = 'x'.repeat(88);
    await render(<MoreText lines={2}>{`   ${exact}   `}</MoreText>);
    expect(screen.getByText(exact)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers the toggle one character past the budget', async () => {
    await render(<MoreText lines={2}>{'x'.repeat(89)}</MoreText>);
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
  });
});

// Policy, money, safety, consent and rights copy must never sit behind More (owner 2026-10-21).
describe('MoreText call sites', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.tsx$/.test(name)) files.push(full);
    }
  };
  walk(path.join(root, 'app'));
  walk(path.join(root, 'src/frontend'));
  const forbidden = /COMPLIANCE_|GIFT_HELD_NOTICE|WORKOUT_IDEAS_LINE|SPLIT|90%|consent|payout|Terms|rights|medical|age/i;

  it('never wraps policy copy', () => {
    const uses: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<MoreText\b[^>]*>([\s\S]*?)<\/MoreText>/g)) uses.push(`${path.relative(root, file)}: ${match[1].trim()}`);
    }
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter((use) => forbidden.test(use.split(': ').slice(1).join(': ')))).toEqual([]);
  });
});

// UX-19 / Codex P2: the inline row is minHeight 44 so the Pressable's full target stays inside its parent.
it('inline toggle keeps its 44pt target inside a 44pt parent row', async () => {
  await render(<MoreText lines={1} inlineToggle>{'x'.repeat(120)}</MoreText>);
  const button = screen.getByRole('button');
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minWidth: 44, minHeight: 44 });
  expect(StyleSheet.flatten(button.props.style).marginVertical).toBeUndefined();
  expect(button.props.hitSlop).toMatchObject({ top: 0, bottom: 0 });
  const row = button.parent;
  expect(StyleSheet.flatten(row?.props.style)).toMatchObject({ minHeight: 44 });
});

