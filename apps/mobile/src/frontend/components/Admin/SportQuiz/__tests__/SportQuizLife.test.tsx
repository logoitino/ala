/** QUIZ-04 Life desk (owner simplification 2026-10-15; switch and levels in Settings as SportQuizLifeSettings, chapter progress counters): switch and thresholds, chapter reasons ("needs N more approved
 * questions") and open gating at 5 approved, aggregate-only statistics; no sign-off, reviewer or re-review controls. Synthetic data. */
import {fireEvent,render,screen} from '@testing-library/react-native';
import {SportQuizLife,SportQuizLifeSettings} from '../SportQuizLife';
import {EMPTY_LIFE_DRAFT,lifeApprovalIssue,lifeChapterTitle} from '../SportQuizLifeQuestion';
import type {LifeAdminSnapshot} from '@/lib/lifePlaybook';

const th={rookie:0,varsity:15,all_star:40,pro:80,hall_of_fame:150};
const state={switched_open:false,open:false,updated_at:'2026-10-14T00:00:00Z',framing:''};
const data:LifeAdminSnapshot={contract_version:4,generated_at:'2026-10-14T00:00:00Z',settings:{life_enabled:false,level_thresholds:th,round_size:5,enabled:true},
  life_cap:200,life_active_total:40,open_at:5,
  chapters:[
    {...state,id:'money_huddle',title:'Money Huddle',framing:'Calling the play before you spend',position:1,draft_count:10,approved_count:5,needs_more:0,ready:true,reasons:[]},
    {...state,id:'savings_season',title:'Savings Season',position:2,draft_count:10,approved_count:4,needs_more:1,ready:false,reasons:['needs 1 more approved question']},
    {...state,id:'scam_defense',title:'Scam Defense',position:3,draft_count:10,approved_count:2,needs_more:3,ready:false,reasons:['needs 3 more approved questions']},
  ],
  stats:{opted_in:null,week_life_rounds:12,questions:[{question_id:'q9',chapter:'money_huddle',responders:24,correct_share:0.75}],questions_hidden:3,
    cells:[{age_band:'adult',chapter:'money_huddle',players:14,hidden:false},{age_band:'teen_13_15',chapter:'money_huddle',players:null,hidden:true}],
    levels:[{level:'rookie',label:'Rookie',players:null,hidden:true}]}};
const handlers={onSaveSettings:jest.fn(),onChapter:jest.fn()};
beforeEach(()=>jest.clearAllMocks());

it('shows each chapter with the reasons it cannot open, and only a ready chapter offers Open',async()=>{
  await render(<SportQuizLife data={data} error={null} busy={null} hasReason {...handlers}/>);
  expect(screen.getByText('Scam Defense: 2 of 5 approved to open')).toBeTruthy();
  expect(screen.getByText('Money Huddle: 5 of 5 approved · ready to open')).toBeTruthy();
  expect(screen.getByText('Cannot open yet: needs 3 more approved questions.')).toBeTruthy();
  expect(screen.getByText('Cannot open yet: needs 1 more approved question.')).toBeTruthy();
  expect(screen.getByText(/opens with 5 approved questions \(one round\)/)).toBeTruthy();
  expect(screen.getByLabelText('Open Scam Defense')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Open Money Huddle'));
  expect(handlers.onChapter).toHaveBeenCalledWith('money_huddle',true);
});
it('saves the switch and thresholds only when changed, valid and with a reason',async()=>{
  const view=await render(<SportQuizLifeSettings data={data} error={null} busy={null} hasReason={false} {...handlers}/>);
  expect(screen.getByLabelText('Save Life switch and levels')).toBeDisabled();
  await view.rerender(<SportQuizLifeSettings data={data} error={null} busy={null} hasReason {...handlers}/>);
  await fireEvent.press(screen.getByLabelText('Life on'));
  await fireEvent.changeText(screen.getByLabelText('Pro at facts learned'),'30');
  expect(screen.getByText(/rise from Rookie 0/)).toBeTruthy();
  expect(screen.getByLabelText('Save Life switch and levels')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Pro at facts learned'),'90');
  await fireEvent.press(screen.getByLabelText('Save Life switch and levels'));
  expect(handlers.onSaveSettings).toHaveBeenCalledWith(true,{...th,pro:90});
});
it('has no CPA sign-off, reviewer grant or re-review controls',async()=>{
  await render(<><SportQuizLife data={data} error={null} busy={null} hasReason {...handlers}/><SportQuizLifeSettings data={data} error={null} busy={null} hasReason {...handlers}/></>);
  for(const label of ['Record CPA sign-off','Grant reviewer','Reviewer profile ID','Signed by (name and credential)'])expect(screen.queryByLabelText(label)).toBeNull();
  for(const text of [/CPA/,/reviewer grant/i,/Re-review/i,/16\+/])expect(screen.queryByText(text)).toBeNull();
});
it('shows statistics aggregate only: hidden cells say so and nothing names a player',async()=>{
  await render(<SportQuizLife data={data} error={null} busy={null} hasReason {...handlers}/>);
  expect(screen.getByText(/Opted in: hidden \(fewer than 10\) · Life rounds this week: 12 · questions below the 20-player threshold: 3/)).toBeTruthy();
  expect(screen.getByText(/q9 · 24 players · 75% chose the reviewed answer/)).toBeTruthy();
  expect(screen.getByText('Rookie: hidden (fewer than 10)')).toBeTruthy();
  expect(screen.getByText('1 age band × chapter cells hidden.')).toBeTruthy();
});
it('says "not switched on" without data and shows a source error',async()=>{
  const view=await render(<SportQuizLife data={null} error={null} busy={null} hasReason {...handlers}/>);
  expect(screen.getByText(/not switched on in this database/)).toBeTruthy();
  await view.rerender(<SportQuizLife data={null} error="boom" busy={null} hasReason {...handlers}/>);
  expect(screen.getByText('Life Playbook source unavailable: boom')).toBeTruthy();
});
it('Life question checks: approval needs only the attestation; chapter titles are the four chapters',()=>{
  expect(lifeApprovalIssue(EMPTY_LIFE_DRAFT)).toMatch(/attestation/);
  expect(lifeApprovalIssue({...EMPTY_LIFE_DRAFT,attest:true})).toBeNull();
  expect(['money_huddle','savings_season','scam_defense','smart_plays'].map(id=>lifeChapterTitle(id as 'money_huddle'))).toEqual(['Money Huddle','Savings Season','Scam Defense','Smart Plays']);
});
