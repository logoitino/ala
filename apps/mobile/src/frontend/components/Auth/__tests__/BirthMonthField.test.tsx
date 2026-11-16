/**
 * Birth month / year use compact dropdown scroll menus — selecting a month updates the draft without a twelve-pill grid.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { BirthMonthField } from '@/components/Auth/BirthMonthField';

describe('BirthMonthField', () => {
  it('opens a month scroll menu and reports the chosen month', async () => {
    const onChange = jest.fn();
    await render(<BirthMonthField value={{ year: null, month: null }} onChange={onChange} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Choose birth month'));
    });
    await waitFor(() => expect(screen.getByLabelText('Birth month list')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Jun'));
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ year: null, month: 6 }));
  });

  it('opens a year scroll menu and reports the chosen year', async () => {
    const onChange = jest.fn();
    await render(<BirthMonthField value={{ year: null, month: 6 }} onChange={onChange} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Choose birth year'));
    });
    await waitFor(() => expect(screen.getByLabelText('Birth year list')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText('2010'));
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ year: 2010, month: 6 }));
  });
});
