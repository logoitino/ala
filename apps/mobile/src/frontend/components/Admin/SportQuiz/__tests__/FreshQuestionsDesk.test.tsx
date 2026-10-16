/** QUIZ-05 Trivia desk panels: Needs a look (reasons, Restore / Dismiss / Archive / Edit), the fun-fact queue (guardian
 * status, checklist-gated Approve, Decline with reason, withdrawn shown), fresh settings (bounds, read-only report rules)
 * and Bulk import (preview before Import as drafts), plus the status lines. Synthetic data; no database is read. */
import {fireEvent,render,screen} from '@testing-library/react-native';
import {SportQuizNeedsLook,lookReasons} from '../SportQuizNeedsLook';
import {SportQuizFacts} from '../SportQuizFacts';
import {SportQuizFreshSettings} from '../SportQuizFreshSettings';
import {SportQuizImport} from '../SportQuizImport';
import {triviaStatus} from '../triviaDesk';
import {FRESH_SELF_HEAL_DEFAULTS,type FactQueue,type FreshStatus,type ImportResult,type NeedsLook,type NeedsLookRow} from '@/lib/freshQuestions';
import type {TimedQuizAdminSnapshot} from '@/lib/sportQuiz';

jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:false,supabase:{}}));
const reports={open:3,counted:2,not_counted:1,wrong_answer:2,confusing:1,not_okay:0,private:0};
const row:NeedsLookRow={question_id:'q1',question_key:'11111111-1111-4111-8111-111111111111',version:1,topic_category:'sport',sport:'Basketball',chapter:null,question_type:'choice4',
  status:'approved',is_fact:false,fact_id:null,prompt:'How many players are on the court for one team?',options:['4','5','6','7'],correct_option:1,
  explanation:'Five players per team are on the court.',source_notes:'Rule book',education_only:false,paused_at:'2026-10-15T00:00:00Z',pause_reason:'reports',
  queued_at:null,restored_at:null,flags:['confusing'],difficulty:'hard',responders:31,right_pct:12,timeout_pct:5,reports};
const look:NeedsLook={contract_version:5,generated_at:'2026-10-15',min_responders:30,count:2,alerts:['science'],
  questions:[row,{...row,question_id:'q2',is_fact:true,fact_id:'f1',topic_category:'athlete',sport:'Fun fact',prompt:'What is Lani\'s hidden talent?',paused_at:null,pause_reason:null,flags:['too_easy'],responders:null}]};
const fresh:FreshStatus={athlete_questions_enabled:false,athlete_share_pct:0,reports_paused:false,self_heal:FRESH_SELF_HEAL_DEFAULTS,needs_look_count:2,paused_count:1,
  facts_admin_review:1,facts_guardian_review:1,facts_live:0,alerts:[],report_rules:{ordinary_reporters:2,fact_reporters:1,fact_reasons:['not_okay','private'],restored_reporters:3,
    daily_pause_cap:10,min_account_days:7,per_account_per_day:10,reporter_clear_days:90,delete_days:180}};
const full={trivia:false,life:false};
beforeEach(()=>jest.clearAllMocks());

describe('Needs a look',()=>{
  it('lists reasons in words with counts only and runs Restore / Dismiss / Archive with the reason',async()=>{
    const act=jest.fn();
    await render(<SportQuizNeedsLook data={look} missing={false} error={null} busy={null} full={full} onAction={act} onEdit={jest.fn()}/>);
    expect(screen.getByText(/Paused: reported by enough accounts/)).toBeTruthy();
    expect(screen.getByText(/31 players · 12% right · 5% ran out of time · hard difficulty/)).toBeTruthy();
    expect(screen.getAllByText(/Wrong answer 2, Confusing 1 \(2 counted, 1 not counted\)/)).toHaveLength(2);
    expect(screen.getByText(/auto-pause limit was reached for: Science/)).toBeTruthy();
    expect(screen.getByLabelText('Restore')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Reason for these actions'),'Checked the rule book again.');
    await fireEvent.press(screen.getByLabelText('Restore'));
    expect(act).toHaveBeenCalledWith('q1','restore','Checked the rule book again.');
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(act).toHaveBeenCalledWith('q2','dismiss','Checked the rule book again.');
    await fireEvent.press(screen.getByLabelText('Archive (decline this fun fact)'));
    expect(act).toHaveBeenCalledWith('q2','archive','Checked the rule book again.');
    expect(screen.getAllByLabelText('Edit')).toHaveLength(1);
  });
  it('opens Edit on the shared form and hands the payload to edit_replace',async()=>{
    const edit=jest.fn();
    await render(<SportQuizNeedsLook data={look} missing={false} error={null} busy={null} full={full} onAction={jest.fn()} onEdit={edit}/>);
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByText('Edit this draft')).toBeTruthy();
  });
  it('says not switched on, never zero',async()=>{
    await render(<SportQuizNeedsLook data={null} missing error={null} busy={null} full={full} onAction={jest.fn()} onEdit={jest.fn()}/>);
    expect(screen.getByText('Needs a look is not switched on in this database.')).toBeTruthy();
    expect(lookReasons({...row,paused_at:null,flags:[],responders:null,reports:{...reports,open:0}})).toEqual([]);
  });
});

describe('fun-fact queue',()=>{
  const base={submitted_at:'2026-10-15',admin_decided_at:null,decline_reason:null,cleared_at:null,question_id:null,paused:false,look_reasons:[] as string[],verified:true,label:'Hidden talent',prompt_key:'hidden_talent' as const};
  const q:FactQueue={contract_version:5,generated_at:'2026-10-15',counts:{waiting_guardian:1,guardian_review:1,admin_review:1,approved:0,declined:0,withdrawn:1,removed:0},
    facts:[{...base,id:'f1',athlete_profile_id:'p1',first_name:'Lani',age_band:'teen_13_15',answer_text:'Beatboxing',status:'admin_review',guardian_status:'approved',look_reasons:['capitalised_pair']},
      {...base,id:'f2',athlete_profile_id:'p2',first_name:'Sione',age_band:'adult',answer_text:null,status:'withdrawn',guardian_status:'not_needed'}]};
  it('needs all three checks before Approve; Decline takes a reason code; withdrawn facts show without text',async()=>{
    const decide=jest.fn();
    await render(<SportQuizFacts data={q} missing={false} error={null} busy={null} onDecide={decide}/>);
    expect(screen.getByText(/Under 16 · guardian approved · verified athlete/)).toBeTruthy();
    expect(screen.getByText(/Two capitalised words/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Decision reason'),'Checked with the checklist.');
    expect(screen.getByLabelText('Approve')).toBeDisabled();
    const yes=screen.getAllByLabelText('Yes');for(const y of yes)await fireEvent.press(y);
    await fireEvent.press(screen.getByLabelText('Approve'));
    expect(decide).toHaveBeenCalledWith('f1',{action:'approve',reason:'Checked with the checklist.',checklist:{no_sponsor_or_business:true,no_place:true,no_schedule:true}});
    // The checklist and reason reset after every decision, so the next fact starts unchecked.
    expect(screen.getByLabelText('Decision reason').props.value).toBe('');
    expect(screen.getByLabelText('Approve')).toBeDisabled();
    expect(screen.getAllByLabelText('Not yet').length).toBe(3);
    await fireEvent.changeText(screen.getByLabelText('Decision reason'),'Checked with the checklist.');
    await fireEvent.press(screen.getByLabelText('Names a place'));
    await fireEvent.press(screen.getByLabelText('Decline'));
    expect(decide).toHaveBeenLastCalledWith('f1',{action:'decline',reason:'Checked with the checklist.',decline_reason:'place'});
    await fireEvent.press(screen.getByLabelText('All (newest 200)'));
    expect(screen.getByText(/Sione · Hidden talent · Removed by the athlete/)).toBeTruthy();
    expect(screen.getByText('Text removed.')).toBeTruthy();
  });
});

describe('fresh settings',()=>{
  it('saves the switch, share, intake and thresholds together only for a valid change with a reason; report rules are read-only',async()=>{
    const save=jest.fn();
    const view=await render(<SportQuizFreshSettings current={fresh} busy={null} hasReason onSave={save}/>);
    expect(screen.getByText(/pause after 2 counted accounts.*at most 10 auto-pauses per topic per day/)).toBeTruthy();
    const btn=()=>screen.getByLabelText('Save fun facts, reports and self-heal');
    expect(btn()).toBeDisabled();
    await fireEvent.press(screen.getAllByLabelText('On')[0]);
    await fireEvent.press(screen.getByLabelText('5'));
    await fireEvent.changeText(screen.getByLabelText(/Players needed before flags/),'10');
    expect(screen.getByText(/whole number inside its range/)).toBeTruthy(); expect(btn()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText(/Players needed before flags/),'40');
    await fireEvent.press(btn());
    expect(save).toHaveBeenCalledWith({athlete_questions_enabled:true,athlete_share_pct:5,reports_paused:false,self_heal:{...FRESH_SELF_HEAL_DEFAULTS,min_responders:40}});
    await view.rerender(<SportQuizFreshSettings current={null} busy={null} hasReason onSave={save}/>);
    expect(screen.getByText(/not switched on/)).toBeTruthy();
  });
});

describe('bulk import',()=>{
  it('previews first, shows rule and duplicate results, then imports exactly those rows as drafts',async()=>{
    const preview=jest.fn();const imp=jest.fn();
    const paste='sport\tBasketball\tchoice4\tHow many players are on the court for one team?\t3\t4\t5\t6\t3\tFive players per team.\tRule book\nsport\tBasketball\tchoice4\tHow many players are on the court for one team?\t3\t4\t5\t6\t3\tFive players per team.\tRule book';
    const view=await render(<SportQuizImport busy={null} hasReason result={null} onPreview={preview} onImport={imp}/>);
    await fireEvent.changeText(screen.getByLabelText('Rows to import'),paste);
    expect(screen.getByLabelText('Import as drafts')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Preview (dry run)'));
    expect(preview).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({sport:'Basketball',correct_option:2})]));
    const result:ImportResult={contract_version:5,dry_run:true,rows_total:2,rows_ready:1,rows_refused:1,rows_warned:0,trivia_left:200,life_left:150,
      rows:[{index:0,status:'ready',problems:[],warnings:[],id:null},{index:1,status:'refused',problems:['duplicate_in_batch'],warnings:[],id:null}]};
    await view.rerender(<SportQuizImport busy={null} hasReason result={result} onPreview={preview} onImport={imp}/>);
    expect(screen.getByText(/Row 2 · Refused .* Repeats an earlier row/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Import as drafts'));
    expect(imp).toHaveBeenCalledTimes(1);
    // Any edit to the paste needs a new preview before Import.
    await fireEvent.changeText(screen.getByLabelText('Rows to import'),paste+'\n');
    expect(screen.getByLabelText('Import as drafts')).toBeDisabled();
  });
});

describe('status lines',()=>{
  it('adds the fun-fact switch, Refill needed under 4 weeks and the Needs a look count',()=>{
    const snap={settings:{contract_version:2,enabled:true,testing_only:true,pilot_accounts:['a'],reason:'Testing now.',updated_at:'x',updated_by:null,round_size:5,groups_enabled:false,images_enabled:false},
      pools:[{topic_category:'sport',sport:'Basketball',approved_count:30}],counts:{questions_draft:0},forecast:[],
      refill:[{scope:'sport',key:'Basketball',approved:30,pace_per_player_week:5,pace_source:'measured',max_seen:20,weeks_left:2,refill_needed:true},
        {scope:'topic',key:'science',approved:40,pace_per_player_week:0,pace_source:'assumed',max_seen:0,weeks_left:8,refill_needed:false}],fresh} as unknown as TimedQuizAdminSnapshot;
    const s=triviaStatus({data:snap,missing:false,error:null},{data:null,missing:true,error:null});
    expect(s.switches).toContain('Fun facts (trivia.athlete_questions): off, share 0%');
    expect(s.low).toContain('Basketball: about 2 weeks left · Refill needed');
    expect(s.low.some(l=>l.startsWith('Science'))).toBe(true);
    expect(s.look).toBe('2 questions need a look (1 paused) · 1 fun fact ready for an admin.');
  });
});
