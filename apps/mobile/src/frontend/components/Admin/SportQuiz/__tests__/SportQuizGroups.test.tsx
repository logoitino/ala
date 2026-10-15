/** QUIZ-03 group desk: counts only, reports by group id, audited case view (ids and age bands) and removal with a reason. Synthetic ids. */
import {fireEvent,render,screen} from '@testing-library/react-native';
import {SportQuizGroups} from '../SportQuizGroups';
import type {TriviaGroupCase} from '@/lib/sportQuiz';
const gid='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const counts={groups_active:2,groups_closed:1,members_active:7,members_removed:1,groups_played_this_week:1,codes_active:2,codes_issued:5,joins_7d:4,refusals_7d:2,
  wrong_codes_7d:3,reports_7d:1,sets_this_week:1,retained_sets:5,retained_join_attempts:9};
const reports=[{id:'5',group_id:gid,reason_code:'unwanted_contact' as const,created_at:'2026-10-14T10:00:00Z'}];
const caseFile:TriviaGroupCase={contract_version:3,generated_at:'2026-10-14T11:00:00Z',group_id:gid,
  group:{name_key:'family',theme_sport:null,status:'active',created_at:'2026-10-13',closed_at:null,close_reason:null,owner_id:member,codes_issued:2,code_active:true},
  members:[{profile_id:member,age_band:'adult',status:'active',joined_at:'2026-10-13',removed_at:null,removed_reason:null,is_owner:true}],
  refusals:[{profile_id:'33333333-3333-4333-8333-333333333333',age_band:'teen_13_15',refusal_reason:'teen_rule',created_at:'2026-10-14'}],
  cases:[{id:'9',kind:'report',actor_id:member,subject_id:null,reason_code:'unwanted_contact',reason:null,created_at:'2026-10-14'}]};
const open=jest.fn();const remove=jest.fn();
beforeEach(()=>jest.clearAllMocks());
it('shows group counts only and picks a report group id for the case',async()=>{
  await render(<SportQuizGroups counts={counts} reports={reports} caseFile={null} busy={null} hasReason onOpenCase={open} onRemove={remove}/>);
  expect(screen.getByText('Members in active groups')).toBeTruthy();
  expect(screen.getByText(/never member names, answers or who played/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(`2026-10-14T10:00:00Z · unwanted contact · group ${gid}`));
  await fireEvent.press(screen.getByLabelText('Open audited case'));
  expect(open).toHaveBeenCalledWith(gid);
});
it('needs a reason and a valid group id before opening a case',async()=>{
  const view=await render(<SportQuizGroups counts={counts} reports={[]} caseFile={null} busy={null} hasReason={false} onOpenCase={open} onRemove={remove}/>);
  await fireEvent.changeText(screen.getByLabelText('Group id from a report or Support'),gid);
  expect(screen.getByLabelText('Open audited case')).toBeDisabled();
  await view.rerender(<SportQuizGroups counts={counts} reports={[]} caseFile={null} busy={null} hasReason onOpenCase={open} onRemove={remove}/>);
  await fireEvent.changeText(screen.getByLabelText('Group id from a report or Support'),'not-a-uuid');
  expect(screen.getByLabelText('Open audited case')).toBeDisabled();
});
it('case view lists member ids, age bands and refusal reasons, then removes a member or closes the group',async()=>{
  await render(<SportQuizGroups counts={counts} reports={reports} caseFile={caseFile} busy={null} hasReason onOpenCase={open} onRemove={remove}/>);
  await fireEvent.changeText(screen.getByLabelText('Group id from a report or Support'),gid);
  expect(screen.getByText(`${member} · adult · active · creator`)).toBeTruthy();
  expect(screen.getByText(/teen_13_15 · teen friend-request rule/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(`Remove ${member}`));
  expect(remove).toHaveBeenCalledWith(gid,member);
  await fireEvent.press(screen.getByLabelText('Close the whole group'));
  expect(remove).toHaveBeenLastCalledWith(gid,null);
});
