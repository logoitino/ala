/** Trivia control tower (2026-10-15): the Home status card states (on / paused / not switched on), the simple
 * "Add a question" defaults and checks (Life word rules, length limits), the player preview, the review queue
 * (Approve / Next / Edit, chapter progress, whole-bank counts and the "(loaded so far)" fallback) and the Settings
 * panel. Synthetic data; no database is read. */
import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {NOT_SWITCHED_ON} from '@/lib/rpc';
import * as quiz from '@/lib/sportQuiz';
import * as lifeLib from '@/lib/lifePlaybook';
import type {LifeAdminSnapshot} from '@/lib/lifePlaybook';
import {TriviaStatusCard} from '../TriviaStatusCard';
import {SportQuizAddQuestion} from '../SportQuizAddQuestion';
import {SportQuizPreview} from '../SportQuizPreview';
import {SportQuizReview} from '../SportQuizReview';
import {SportQuizSettings} from '../SportQuizSettings';
import {AdminHomeCards,AdminHomeCardsContext} from '@/components/Admin/AdminHomeCards';
import {triviaStatus} from '../triviaDesk';

const mockPush=jest.fn();
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:false,supabase:{}}));
jest.mock('expo-router',()=>({useRouter:()=>({push:mockPush}),
  Link:({children,href}:{children:React.ReactElement;href:string})=>require('react').createElement(jest.requireActual('expo-router/build/ui/Slot').Slot,{href,onPress:()=>mockPush(href)},children)}));
jest.mock('@/lib/sportQuiz',()=>({...jest.requireActual('@/lib/sportQuiz'),fetchTimedSportQuizAdmin:jest.fn()}));
jest.mock('@/lib/lifePlaybook',()=>({...jest.requireActual('@/lib/lifePlaybook'),fetchLifeAdmin:jest.fn()}));
const api=jest.mocked(quiz);const lifeApi=jest.mocked(lifeLib);

const th={rookie:0,varsity:15,all_star:40,pro:80,hall_of_fame:150};
const ch={switched_open:false,open:false,updated_at:'2026-10-15T00:00:00Z',framing:'',reasons:[] as string[]};
const life:LifeAdminSnapshot={contract_version:4,generated_at:'2026-10-15T00:00:00Z',settings:{life_enabled:true,level_thresholds:th,round_size:5,enabled:true},life_cap:200,life_active_total:12,open_at:5,
  chapters:[{...ch,id:'money_huddle',title:'Money Huddle',position:1,draft_count:2,approved_count:3,needs_more:2,ready:false},
    {...ch,id:'savings_season',title:'Savings Season',position:2,draft_count:0,approved_count:5,needs_more:0,ready:true,switched_open:true,open:true},
    {...ch,id:'scam_defense',title:'Scam Defense',position:3,draft_count:1,approved_count:0,needs_more:5,ready:false},
    {...ch,id:'smart_plays',title:'Smart Plays',position:4,draft_count:0,approved_count:5,needs_more:0,ready:true}],
  stats:{opted_in:null,week_life_rounds:null,questions:[],questions_hidden:0,cells:[],levels:[]}};
const base={id:'q1',question_key:'11111111-1111-4111-8111-111111111111',version:1,topic_category:'science' as const,sport:'Science',prompt:'What pulls a ball back down after it is thrown up?',
  options:['Gravity','Magnetism','Sound','Light'],correct_option:0,explanation:'Gravity pulls everything toward the ground.',source_notes:'Everyday fact',status:'draft' as const,
  reason:'Added in admin',created_at:'2026-10-15',created_by:null,reviewed_at:null,reviewed_by:null,question_type:'choice4' as const};
const lifeDraft={...base,id:'l1',question_key:'22222222-2222-4222-8222-222222222222',topic_category:'life' as const,sport:'Money Huddle',chapter:'money_huddle' as const,min_age_band:'13' as const,education_only:true,
  prompt:'A budget plans where money goes before it is spent.',options:['True','False'],question_type:'true_false' as const,explanation:'True. A budget is a game plan for money.'};
const snapshot={contract_version:2,generated_at:'2026-10-15T05:00:00Z',week_start:'2026-10-12',week_end:'2026-10-19',
  settings:{contract_version:2,enabled:true,testing_only:true,pilot_accounts:['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'],reason:'Testing with two accounts.',updated_at:'2026-10-15',updated_by:null,round_size:5,groups_enabled:true,images_enabled:false},
  questions:[base,lifeDraft],question_total:2,question_cap:300,active_total:1,life_active_total:1,life_cap:200,next_question_cursor:null,audit:[],next_before:null,
  counts:{questions_draft:7,questions_approved:20,questions_archived:0,questions_void:0,week_issued:0,week_completed:0,week_skipped:0,week_void:0,badges_issued:0,badges_void:0,week_ended:0,week_expired:0,preferences_weekly:0,exposures:0,week_spent:0,retained_guards:0,retained_requests:0},
  pools:[{topic_category:'science',sport:'Science',approved_count:8},{topic_category:'geography',sport:'Geography',approved_count:2},{topic_category:'sport',sport:'Rugby',approved_count:3}],
  forecast:[{sport:'Basketball',approved_families:12,players_28d:3,issued_28d:9,pace_per_player_week:3,max_seen:6,weeks_left:1}],
} as quiz.TimedQuizAdminSnapshot;
beforeEach(()=>{jest.clearAllMocks();api.fetchTimedSportQuizAdmin.mockResolvedValue(snapshot);lifeApi.fetchLifeAdmin.mockResolvedValue(life);});

describe('Home Trivia status card',()=>{
  it('shows trivia on for testers, the switches, drafts, chapters open, what is running low and the desk link',async()=>{
    await render(<TriviaStatusCard/>);
    expect(await screen.findByText('Trivia: On for 2 tester accounts · testing only')).toBeTruthy();
    expect(screen.getByText('Groups (trivia.groups): on · Life Playbook (trivia.life): on · Images (trivia.images): off, locked')).toBeTruthy();
    expect(screen.getByText('7 drafts waiting for approval (3 Life Playbook).')).toBeTruthy();
    expect(screen.getByText('1 of 4 Life chapters open')).toBeTruthy();
    expect(screen.getByText(/^Running low: Geography: 2 approved \(a full round needs 5\); Fun: none approved/)).toBeTruthy();
    expect(screen.getByText(/and 2 more\.$/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('link',{name:'Open the Trivia desk'}));
    expect(mockPush).toHaveBeenCalledWith('/admin/sport-quiz');
  });
  it('uses the whole-bank review counts for drafts waiting when the server sends them',async()=>{
    api.fetchTimedSportQuizAdmin.mockResolvedValue({...snapshot,bank_counts:{topics:[{topic_category:'life',draft_count:41,approved_count:13},{topic_category:'sport',draft_count:23,approved_count:3}],sports:[],chapters:[]}});
    await render(<TriviaStatusCard/>);
    expect(await screen.findByText('64 drafts waiting for approval (41 Life Playbook).')).toBeTruthy();
  });
  it('says Paused when trivia is paused',async()=>{
    api.fetchTimedSportQuizAdmin.mockResolvedValue({...snapshot,settings:{...snapshot.settings!,enabled:false}});
    await render(<TriviaStatusCard/>);
    expect(await screen.findByText('Trivia: Paused')).toBeTruthy();
  });
  it('says "not switched on" (never zero) when the reads are not applied',async()=>{
    api.fetchTimedSportQuizAdmin.mockRejectedValue(new Error(NOT_SWITCHED_ON));
    lifeApi.fetchLifeAdmin.mockRejectedValue(new Error(NOT_SWITCHED_ON));
    await render(<TriviaStatusCard/>);
    expect(await screen.findByText('Trivia: Trivia is not switched on in this database.')).toBeTruthy();
    expect(screen.getByText('Drafts waiting for approval: not switched on.')).toBeTruthy();
    expect(screen.getByText('Life chapters: not switched on.')).toBeTruthy();
    expect(screen.getByText('Life Playbook (trivia.life): not switched on')).toBeTruthy();
    expect(screen.queryByText(/\b0 drafts|0 of 4/)).toBeNull();
  });
  it('keeps a failed read as an error, and Life alone can be not switched on',async()=>{
    api.fetchTimedSportQuizAdmin.mockRejectedValue(new Error('timeout'));
    await render(<TriviaStatusCard/>);
    expect(await screen.findByText('Trivia: Trivia status could not be read: timeout')).toBeTruthy();
    const s=triviaStatus({data:snapshot,missing:false,error:null},{data:null,missing:true,error:null});
    expect(s.chapters).toBe('Life chapters: not switched on.');expect(s.drafts).toBe('7 drafts waiting for approval.');
  });
  it('appears on Home only where the Home route supplies it',async()=>{
    const view=await render(<AdminHomeCards/>);
    expect(screen.queryByText('Trivia')).toBeNull();expect(api.fetchTimedSportQuizAdmin).not.toHaveBeenCalled();
    await view.rerender(<AdminHomeCardsContext.Provider value={<TriviaStatusCard/>}><AdminHomeCards/></AdminHomeCardsContext.Provider>);
    expect(await screen.findByText('Trivia: On for 2 tester accounts · testing only')).toBeTruthy();
  });
});

describe('Add a question',()=>{
  const onSave=jest.fn();
  const full={trivia:false,life:false};
  it('starts simple with safe defaults and saves a new-family draft with the "Everyday fact" source note',async()=>{
    await render(<SportQuizAddQuestion busy={null} full={full} onSave={onSave}/>);
    expect(screen.getByLabelText('True or false').props.accessibilityState).toEqual(expect.objectContaining({selected:true}));
    expect(screen.queryByLabelText('Source note')).toBeNull();
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.getByLabelText('Source note').props.value).toBe('Everyday fact');
    expect(screen.getByLabelText('Reason for the record').props.value).toBe('Added in admin');
    expect(screen.getByLabelText('New family').props.accessibilityState).toEqual(expect.objectContaining({selected:true}));
    expect(screen.getByLabelText('Save draft for review')).toBeDisabled();
    expect(screen.getByText('Fix: Pick a sport.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Volleyball'));
    await fireEvent.changeText(screen.getByLabelText('Question'),'A volleyball team may touch the ball three times before returning it.');
    await fireEvent.press(screen.getByLabelText('True'));
    await fireEvent.changeText(screen.getByLabelText('Short explanation'),'Three touches are allowed before the ball goes back over.');
    expect(screen.getByLabelText('Save draft for review')).toBeEnabled();
    await fireEvent.press(screen.getByLabelText('Save draft for review'));
    expect(onSave).toHaveBeenCalledWith({reason:'Added in admin',sport:'Volleyball',prompt:'A volleyball team may touch the ball three times before returning it.',options:['True','False'],correct_option:0,
      explanation:'Three touches are allowed before the ball goes back over.',topic_category:'sport',source_notes:'Everyday fact',question_type:'true_false',family_action:'new'});
  });
  it('refuses a Life question that breaks the word rules, with the rule in plain words',async()=>{
    await render(<SportQuizAddQuestion busy={null} full={full} onSave={onSave}/>);
    await fireEvent.press(screen.getByLabelText('Life Playbook'));
    await fireEvent.press(screen.getByLabelText('Money Huddle'));
    await fireEvent.changeText(screen.getByLabelText('Question'),'A pair of shoes costs $40, so you should save first.');
    await fireEvent.press(screen.getByLabelText('False'));
    await fireEvent.changeText(screen.getByLabelText('Short explanation'),'Planning before spending is a game plan.');
    await fireEvent.press(screen.getByLabelText('A simple everyday fact; no advice, products or brands'));
    expect(screen.getByText('Fix: Life Playbook word rules: fix the items below.')).toBeTruthy();
    expect(screen.getByText(/No advice such as “you should”/)).toBeTruthy();
    expect(screen.getByText(/No money amounts, prices, percentages/)).toBeTruthy();
    expect(screen.getByLabelText('Save draft for review')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Question'),'Planning before spending is called a budget.');
    expect(screen.getByText('OK: Life Playbook word rules: none broken.')).toBeTruthy();
    expect(screen.getByLabelText('Save draft for review')).toBeEnabled();
    await fireEvent.press(screen.getByLabelText('Save draft for review'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({topic_category:'life',chapter:'money_huddle',min_age_band:'13',education_only:true,source_notes:'Everyday fact'}));
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('sport');
  });
  it('shows the length limits live: Life 120 / 200, other topics 280 / 500',async()=>{
    await render(<SportQuizAddQuestion busy={null} full={full} onSave={onSave}/>);
    await fireEvent.press(screen.getByLabelText('Science'));
    await fireEvent.changeText(screen.getByLabelText('Question'),'a'.repeat(121));
    expect(screen.getByText('OK: Question: 121 of 280 characters.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Life Playbook'));
    expect(screen.getByText('Fix: Question: 121 of 120 characters.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Short explanation'),'b'.repeat(201));
    expect(screen.getByText('Fix: Explanation: 201 of 200 characters.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Scam Defense'));
    expect(screen.getByText(/end with “Tell a trusted adult and use Report.”/)).toBeTruthy();
  });
  it('previews four choices with the correct one marked in words',async()=>{
    await render(<SportQuizAddQuestion busy={null} full={full} onSave={onSave}/>);
    await fireEvent.press(screen.getByLabelText('Four choices'));
    for(const [i,a] of ['Gravity','Magnetism','Sound','Light'].entries())await fireEvent.changeText(screen.getByLabelText(`Answer ${i+1}`),a);
    await fireEvent.press(screen.getByLabelText('1. Gravity'));
    expect(screen.getByLabelText('Answer Gravity, correct answer')).toBeTruthy();
    expect(screen.getByLabelText('Answer Light')).toBeTruthy();
  });
});

it('player preview shows True / False as two big answers and the explanation',async()=>{
  await render(<SportQuizPreview topic="Science" prompt="The sun is a star." type="true_false" options={['True','False']} correct={0} explanation="The sun is our closest star."/>);
  expect(screen.getByText('Player preview · Science')).toBeTruthy();
  expect(screen.getByLabelText('Answer True, correct answer')).toBeTruthy();
  expect(screen.getByLabelText('Answer False')).toBeTruthy();
  expect(screen.getByText('✓ Correct answer')).toBeTruthy();
  expect(screen.getByText('After answering: The sun is our closest star.')).toBeTruthy();
});

describe('Drafts to review',()=>{
  const onWrite=jest.fn(),onRevise=jest.fn(),onLoadMore=jest.fn();
  const props={questions:[base,lifeDraft,{...base,id:'q3',status:'approved' as const}],draftTotal:7,life,busy:null,imagesEnabled:false,full:{trivia:false,life:false},nextCursor:null,onLoadMore,onWrite,onRevise};
  it('walks drafts one at a time and approves each with the session reason through the approve path',async()=>{
    await render(<SportQuizReview {...props}/>);
    expect(screen.getByLabelText('Session reason').props.value).toBe('Content review');
    expect(screen.getByText('Draft 1 of 2 loaded in this view · 2 drafts in this view (loaded so far) · 2 of 7 drafts loaded.')).toBeTruthy();
    expect(screen.getByText('What pulls a ball back down after it is thrown up?')).toBeTruthy();
    expect(screen.getByText('Source note: Everyday fact')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Approve'));
    expect(onWrite).toHaveBeenCalledWith('q1','approve',{reason:'Content review'});
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Draft 2 of 2 loaded in this view · 2 drafts in this view (loaded so far) · 2 of 7 drafts loaded.')).toBeTruthy();
    expect(screen.getByText('A budget plans where money goes before it is spent.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Session reason'),'Weekly fact check');
    await fireEvent.press(screen.getByLabelText('Archive'));
    expect(onWrite).toHaveBeenLastCalledWith('l1','archive',{reason:'Weekly fact check'});
  });
  it('shows Life chapter progress towards opening and filters by chapter',async()=>{
    await render(<SportQuizReview {...props}/>);
    // No whole-bank counts in these props: chapter drafts come from the Life read (server), never the loaded pages.
    expect(screen.getByText('Money Huddle: 3 of 5 approved to open · 2 drafts waiting')).toBeTruthy();
    expect(screen.getByText('Savings Season: open · 5 approved · 0 drafts waiting')).toBeTruthy();
    expect(screen.getByText('Smart Plays: 5 of 5 approved · ready to open · 0 drafts waiting')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Life Playbook (1)'));
    await fireEvent.press(screen.getByLabelText('Scam Defense (0)'));
    expect(screen.getByText('No drafts match this view.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Money Huddle (1)'));
    expect(screen.getByText('Draft 1 of 1 loaded in this view · 1 draft in this view (loaded so far) · 2 of 7 drafts loaded.')).toBeTruthy();
  });
  it('blocks Approve for a Life draft without the attestation and edits it into a new version',async()=>{
    await render(<SportQuizReview {...props} questions={[{...lifeDraft,education_only:false}]}/>);
    expect(screen.getByText('Missing the education-only attestation. Edit this draft to add it.')).toBeTruthy();
    expect(screen.getByLabelText('Approve')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByText('Edit this draft')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('A simple everyday fact; no advice, products or brands'));
    await fireEvent.press(screen.getByLabelText('Save new version'));
    expect(onRevise).toHaveBeenCalledWith('l1',expect.objectContaining({family_action:'existing',question_key:lifeDraft.question_key,education_only:true,reason:'Content review',chapter:'money_huddle'}));
  });
  // Whole-bank counts: 64 drafts on the server, 2 loaded (one 50-row page would hold at most 50).
  const bankCounts={topics:[{topic_category:'life' as const,draft_count:41,approved_count:13},{topic_category:'science' as const,draft_count:9,approved_count:8},{topic_category:'sport' as const,draft_count:14,approved_count:3}],
    sports:[{sport:'Rugby',draft_count:11,approved_count:3},{sport:'Volleyball',draft_count:3,approved_count:0}],
    chapters:[{chapter:'money_huddle',draft_count:12,approved_count:3},{chapter:'savings_season',draft_count:10,approved_count:5},{chapter:'scam_defense',draft_count:9,approved_count:0},{chapter:'smart_plays',draft_count:10,approved_count:5}]};
  it('counts drafts beyond the loaded pages from the whole bank: filters, sports with unloaded drafts and chapter progress',async()=>{
    await render(<SportQuizReview {...props} bankCounts={bankCounts}/>);
    expect(screen.getByText('Draft counts cover the whole question bank, loaded or not.')).toBeTruthy();
    expect(screen.queryByText(/loaded so far/)).toBeNull();
    expect(screen.getByLabelText('All topics (64)')).toBeTruthy();
    expect(screen.getByLabelText('Science (9)')).toBeTruthy();expect(screen.getByLabelText('Fun (0)')).toBeTruthy();
    expect(screen.getByText('Draft 1 of 2 loaded in this view · 64 drafts in this view in the whole bank · 2 of 64 drafts loaded.')).toBeTruthy();
    expect(screen.getByText('Money Huddle: 3 of 5 approved to open · 12 drafts waiting')).toBeTruthy();
    expect(screen.getByText('Scam Defense: 0 of 5 approved to open · 9 drafts waiting')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Sports (14)'));
    // No sports draft is loaded, yet both sports with drafts are offered with their bank counts.
    expect(screen.getByLabelText('Rugby (11)')).toBeTruthy();expect(screen.getByLabelText('Volleyball (3)')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Rugby (11)'));
    expect(screen.getByText('No drafts match this view.')).toBeTruthy();
    expect(screen.getByText('No drafts loaded in this view · 11 drafts in this view in the whole bank · 2 of 64 drafts loaded.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Life Playbook (41)'));
    await fireEvent.press(screen.getByLabelText('Money Huddle (12)'));
    expect(screen.getByText('Draft 1 of 1 loaded in this view · 12 drafts in this view in the whole bank · 2 of 64 drafts loaded.')).toBeTruthy();
  });
  it('labels loaded-page counts "(loaded so far)" on a server without whole-bank counts and offers Load more',async()=>{
    await render(<SportQuizReview {...props} nextCursor="cursor-2"/>);
    expect(screen.getByText('Draft counts (loaded so far): this database does not send whole-bank counts yet.')).toBeTruthy();
    expect(screen.getByLabelText('All topics (2)')).toBeTruthy();expect(screen.getByLabelText('Science (1)')).toBeTruthy();
    expect(screen.getByText('Draft 1 of 2 loaded in this view · 2 drafts in this view (loaded so far) · 2 of 7 drafts loaded. Load more questions to see the rest.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Load more questions to review'));
    expect(onLoadMore).toHaveBeenCalled();
  });
});

describe('Settings panel',()=>{
  it('gathers trivia state, the groups / Life switches, locked images, round size and levels',async()=>{
    const onConfigure=jest.fn(),onSavePlay=jest.fn(),onSaveLife=jest.fn();
    await render(<SportQuizSettings settings={snapshot.settings} weekStart="2026-10-12" weekEnd="2026-10-19" generatedAt="2026-10-15" testers="" onTesters={jest.fn()} pilotIds={[]} validTesters
      hasReason busy={null} onConfigure={onConfigure} play={{round_size:5,groups_enabled:true,images_enabled:false}} onSavePlay={onSavePlay} life={life} lifeError={null} onSaveLife={onSaveLife}/>);
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText(/Enabled for listed testers · testing only · 2\/100 tester accounts/)).toBeTruthy();
    expect(screen.getByText(/Images \(trivia.images\): off, locked/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Pause quiz'));
    expect(onConfigure).toHaveBeenCalledWith(false,snapshot.settings!.pilot_accounts);
    await fireEvent.press(screen.getByLabelText('3'));
    await fireEvent.press(screen.getByLabelText('Off'));
    await fireEvent.press(screen.getByLabelText('Save round settings and switches'));
    expect(onSavePlay).toHaveBeenCalledWith({round_size:3,groups_enabled:false,images_enabled:false});
    await fireEvent.press(screen.getByLabelText('Life off'));
    await fireEvent.changeText(screen.getByLabelText('Varsity at facts learned'),'10');
    await fireEvent.press(screen.getByLabelText('Save Life switch and levels'));
    await waitFor(()=>expect(onSaveLife).toHaveBeenCalledWith(false,{...th,varsity:10}));
  });
});
