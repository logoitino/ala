/** QUIZ-03 round settings and switches: reason-gated save of a changed size/switch, and the per-sport forecast. Synthetic data.
 * Control tower (2026-10-15): images are locked off (no images switch to press; every save sends it off). */
import {fireEvent,render,screen} from '@testing-library/react-native';
import {SportQuizForecast,SportQuizPlay} from '../SportQuizPlay';
const save=jest.fn();
const current={round_size:5,groups_enabled:false,images_enabled:false};
const forecast=[{sport:'Basketball',approved_families:12,players_28d:3,issued_28d:9,pace_per_player_week:3,max_seen:6,weeks_left:2},
  {sport:'Rugby',approved_families:4,players_28d:0,issued_28d:0,pace_per_player_week:0,max_seen:0,weeks_left:null}];
beforeEach(()=>jest.clearAllMocks());
it('saves round size and both switches together only after a change and with a reason',async()=>{
  const view=await render(<SportQuizPlay current={current} busy={null} hasReason={false} onSave={save}/>);
  expect(screen.getByText(/Now: 5 questions per round · trivia.groups off · trivia.images off/)).toBeTruthy();
  expect(screen.getByLabelText('Save round settings and switches')).toBeDisabled();
  await view.rerender(<SportQuizPlay current={current} busy={null} hasReason onSave={save}/>);
  expect(screen.getByLabelText('Save round settings and switches')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('3'));
  await fireEvent.press(screen.getAllByLabelText('On')[0]);
  await fireEvent.press(screen.getByLabelText('Save round settings and switches'));
  expect(save).toHaveBeenCalledWith({round_size:3,groups_enabled:true,images_enabled:false});
});
it('explains the switches and shows weeks left per sport, or no forecast without recent play',async()=>{
  await render(<><SportQuizPlay current={current} busy={null} hasReason onSave={save}/><SportQuizForecast forecast={forecast}/></>);
  expect(screen.getByText(/Off pauses new groups, joins and group rounds/)).toBeTruthy();
  expect(screen.getByText(/approved image questions are never drawn/)).toBeTruthy();
  expect(screen.getByText(/Basketball · 12 approved .* about 2 weeks left/)).toBeTruthy();
  expect(screen.getByText(/Rugby · 4 approved .* no forecast yet/)).toBeTruthy();
});
it('offers no controls when settings are unavailable',async()=>{
  await render(<SportQuizPlay current={null} busy={null} hasReason onSave={save}/>);
  expect(screen.getByText(/Settings unavailable/)).toBeTruthy();
  expect(screen.queryByLabelText('Save round settings and switches')).toBeNull();
});
it('keeps images locked off: no images switch, and a save while images are on turns them off',async()=>{
  await render(<SportQuizPlay current={{...current,images_enabled:true}} busy={null} hasReason onSave={save}/>);
  expect(screen.getAllByLabelText('On')).toHaveLength(1);
  expect(screen.getByText(/Images \(trivia.images\): on now; saving turns it off, locked/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Save round settings and switches'));
  expect(save).toHaveBeenCalledWith({round_size:5,groups_enabled:false,images_enabled:false});
});
