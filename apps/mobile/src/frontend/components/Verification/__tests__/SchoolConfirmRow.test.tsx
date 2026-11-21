import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ROSTER_ATTESTATION, SchoolConfirmRow } from '@/components/Verification/SchoolConfirmRow';

let mockConfirmPress: () => void;
jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  const React = jest.requireActual('react');
  return { HapticPressable: (props: any) => {
    if (props.children?.props?.children === 'Confirm') mockConfirmPress = props.onPress;
    return React.createElement(Pressable, props);
  } };
});

const REQUEST = {
  id: 'q1',
  fullName: 'Malia Tui',
  sport: 'Rugby',
  classYear: '2027',
  jersey: '9',
  createdAt: null,
  codeReady: true,
};

describe('SchoolConfirmRow', () => {
  it('only confirms after the code, the in-person tick and a signature', async () => {
    const onDecide = jest.fn(async () => ({ ok: true as const, status: 'approved' as const }));
    await render(<SchoolConfirmRow request={REQUEST} signature="Ana Tui" onDecide={onDecide} />);

    await fireEvent.press(screen.getByText('Confirm'));
    expect(onDecide).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('6-digit code for Malia Tui'), '04-29 17');
    await fireEvent.press(screen.getByText('Confirm'));
    expect(onDecide).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText(ROSTER_ATTESTATION));
    await fireEvent.press(screen.getByText('Confirm'));
    expect(onDecide).toHaveBeenCalledWith(true, '042917');
  });

  it('shows the server error and clears the code after a wrong code', async () => {
    const onDecide = jest.fn(async () => ({ ok: false as const, error: 'That code does not match.' }));
    await render(<SchoolConfirmRow request={REQUEST} signature="Ana Tui" onDecide={onDecide} />);
    await fireEvent.changeText(screen.getByLabelText('6-digit code for Malia Tui'), '111111');
    await fireEvent.press(screen.getByLabelText(ROSTER_ATTESTATION));
    await fireEvent.press(screen.getByText('Confirm'));
    expect(await screen.findByText('That code does not match.')).toBeTruthy();
    expect(screen.getByLabelText('6-digit code for Malia Tui').props.value).toBe('');
  });

  it('asks for a signature first', async () => {
    await render(<SchoolConfirmRow request={REQUEST} signature="" onDecide={jest.fn()} />);
    expect(screen.getByText(/Sign with your full name/)).toBeTruthy();
  });
});

it('recovers an editable row after a thrown decision without losing the in-person requirement', async () => {
  const onDecide = jest.fn().mockRejectedValue(new Error('Synthetic decision failed'));
  await render(<SchoolConfirmRow request={REQUEST} signature="Ana Tui" onDecide={onDecide} />);
  await fireEvent.changeText(screen.getByLabelText('6-digit code for Malia Tui'), '111111');
  await fireEvent.press(screen.getByLabelText(ROSTER_ATTESTATION));
  await fireEvent.press(screen.getByText('Confirm'));
  expect(await screen.findByText('Synthetic decision failed')).toBeTruthy();
  expect(screen.getByLabelText('6-digit code for Malia Tui').props.editable).toBe(true);
});
it('accepts at most one decision before busy renders', async () => {
  let resolve!: (v: {ok: true; status: 'approved'}) => void;
  const pending = new Promise<{ok: true; status: 'approved'}>(done => { resolve = done; }); const onDecide = jest.fn(() => pending);
  await render(<SchoolConfirmRow request={REQUEST} signature="Ana Tui" onDecide={onDecide} />);
  await fireEvent.changeText(screen.getByLabelText('6-digit code for Malia Tui'), '111111'); await fireEvent.press(screen.getByLabelText(ROSTER_ATTESTATION));
  await act(async () => { mockConfirmPress(); mockConfirmPress(); });
  expect(onDecide).toHaveBeenCalledTimes(1); await act(async () => resolve({ok:true,status:'approved'}));
});
