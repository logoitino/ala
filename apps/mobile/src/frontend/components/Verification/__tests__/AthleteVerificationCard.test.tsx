import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  AthleteVerificationCardView,
  verificationCardState,
} from '@/components/Verification/AthleteVerificationCard';
import { VERIFY_HELD_COPY } from '@/data/verification';
import type { MyVerification } from '@/lib/verification';

jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});

const PENDING: MyVerification = {
  status: 'pending',
  requestStatus: 'pending',
  schoolName: 'Westlake High',
  hasSchool: true,
  sport: 'Rugby',
  codeExpiresAt: null,
  confirmerName: null,
  decisionNote: null,
};

describe('verificationCardState', () => {
  it('hides for verified accounts and plain fans', () => {
    expect(verificationCardState({ ...PENDING, status: 'verified', requestStatus: 'approved' }, true)).toBe('hidden');
    expect(verificationCardState({ ...PENDING, status: 'unverified', requestStatus: null }, false)).toBe('hidden');
    expect(verificationCardState(null, true)).toBe('hidden');
  });

  it('maps claim states', () => {
    expect(verificationCardState(PENDING, true)).toBe('pending');
    expect(verificationCardState({ ...PENDING, requestStatus: 'disputed' }, true)).toBe('disputed');
    expect(verificationCardState({ ...PENDING, status: 'unverified', requestStatus: 'rejected' }, true)).toBe('declined');
    expect(verificationCardState({ ...PENDING, status: 'unverified', requestStatus: null }, true)).toBe('unclaimed');
  });
});

describe('AthleteVerificationCardView', () => {
  const noop = () => undefined;

  it('tells a pending athlete their gifts are held and how to get confirmed', async () => {
    const onShowCode = jest.fn();
    await render(
      <AthleteVerificationCardView
        state="pending"
        verification={PENDING}
        code={null}
        error={null}
        busy={false}
        onShowCode={onShowCode}
        onClaim={noop}
      />,
    );
    expect(screen.getByText('⏳ Verification pending')).toBeTruthy();
    expect(screen.getByText(VERIFY_HELD_COPY)).toBeTruthy();
    expect(screen.getByText(/athletic director or coach at Westlake High/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Show my school code'));
    expect(onShowCode).toHaveBeenCalled();
  });

  it('shows a live code big, with its expiry', async () => {
    const expiresAt = new Date(Date.now() + 20 * 60000).toISOString();
    await render(
      <AthleteVerificationCardView
        state="pending"
        verification={PENDING}
        code={{ code: '042917', expiresAt }}
        error={null}
        busy={false}
        onShowCode={noop}
        onClaim={noop}
      />,
    );
    expect(screen.getByText('042917')).toBeTruthy();
    expect(screen.getByText(/Valid until/)).toBeTruthy();
    expect(screen.getByText('Make a new code')).toBeTruthy();
  });

  it('asks for a school before offering a code', async () => {
    await render(
      <AthleteVerificationCardView
        state="pending"
        verification={{ ...PENDING, hasSchool: false, schoolName: null }}
        code={null}
        error={null}
        busy={false}
        onShowCode={noop}
        onClaim={noop}
      />,
    );
    expect(screen.getByText(/Add your school/)).toBeTruthy();
    expect(screen.queryByText('Show my school code')).toBeNull();
  });

  it('explains a declined claim with the school note and lets them ask again', async () => {
    const onClaim = jest.fn();
    await render(
      <AthleteVerificationCardView
        state="declined"
        verification={{ ...PENDING, status: 'unverified', requestStatus: 'rejected', decisionNote: 'Not on the 2026 roster' }}
        code={null}
        error={null}
        busy={false}
        onShowCode={noop}
        onClaim={onClaim}
      />,
    );
    expect(screen.getByText(/Not on the 2026 roster/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Ask again'));
    expect(onClaim).toHaveBeenCalled();
  });
});
