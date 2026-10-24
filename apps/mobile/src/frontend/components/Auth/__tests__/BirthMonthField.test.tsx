/**
 * Birth year must stay editable while incomplete — parent `year: null` used to wipe each keystroke.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { BirthMonthField } from '@/components/Auth/BirthMonthField';

describe('BirthMonthField', () => {
  it('keeps partial year digits visible while the parent year is still null', async () => {
    const onChange = jest.fn();
    const view = await render(<BirthMonthField value={{ year: null, month: 6 }} onChange={onChange} />);

    fireEvent.changeText(screen.getByLabelText('Birth year'), '2');
    expect(onChange).toHaveBeenLastCalledWith({ year: null, month: 6 });
    await waitFor(() => expect(screen.getByLabelText('Birth year').props.value).toBe('2'));

    // Parent still has year: null (incomplete) — same draft must not wipe digits.
    await view.rerender(<BirthMonthField value={{ year: null, month: 6 }} onChange={onChange} />);
    expect(screen.getByLabelText('Birth year').props.value).toBe('2');

    fireEvent.changeText(screen.getByLabelText('Birth year'), '2010');
    expect(onChange).toHaveBeenLastCalledWith({ year: 2010, month: 6 });
    await waitFor(() => expect(screen.getByLabelText('Birth year').props.value).toBe('2010'));
  });
});
