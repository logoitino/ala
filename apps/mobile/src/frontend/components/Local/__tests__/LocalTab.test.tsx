/** Compact Local routing keeps sponsors in Boosters and preserves school/region discovery. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { FONT } from '@/theme/fonts';
import { FOCAL } from '@/theme/motion';
import LocalTab from '../../../../../app/(tabs)/local/index';
import { cloneAppRuntime, DEFAULT_APP_RUNTIME } from '@/lib/runtime';
let mockLive = cloneAppRuntime(DEFAULT_APP_RUNTIME);
const mockSponsor = { id:'fixture-sponsor', business_name:'Fixture Community Sponsor', logo_url:'', school_team:'North Valley High School', tier:'silver', status:'active' };
let mockSponsors = [mockSponsor];
beforeEach(() => { mockLive=cloneAppRuntime(DEFAULT_APP_RUNTIME); mockSponsors=[mockSponsor]; });
jest.mock('@expo/vector-icons/Ionicons',()=> 'Ionicons');
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()}), useLocalSearchParams:()=>({}),usePathname:()=>'/local'}));
jest.mock('@/context/AppRuntimeContext',()=>({useAppRuntime:()=>({live:mockLive})}));
jest.mock('@/hooks/useLiveScores',()=>({useLiveScores:()=>({games:[],loading:false,error:null,refresh:jest.fn()})}));
jest.mock('@/hooks/useSponsorships',()=>({useSponsorships:()=>({sponsors:mockSponsors,recordSponsorship:jest.fn()})}));
jest.mock('@/hooks/useCheerPoll',()=>({usePublishedCheerPolls:()=>[]}));
jest.mock('@/hooks/useSurfaceUsage',()=>({useSurfaceUsage:()=>({onScroll:jest.fn(),trackFeature:jest.fn()})}));
jest.mock('@/components/TabScreen',()=>({TabScreen:({children}:any)=>children}));
jest.mock('@/components/ScreenHeading',()=>({ScreenHeading:()=>null}));
jest.mock('@/components/UI/EmptyState',()=>({EmptyState:()=>null}));
jest.mock('@/components/Effects/ScrollFx',()=>{
 const {ScrollView}=require('react-native');
 return {ScrollFxScrollView:ScrollView,ScrollFxItem:({children}:any)=>children};
});
jest.mock('@/components/Local/SponsorshipModal',()=>({SponsorshipModal:()=>null}));
jest.mock('@/components/Local/TopAuraBoosters',()=>{ const {Text}=require('react-native'); return {TopAuraBoosters:()=><Text>Aura rank fixture</Text>}; });
jest.mock('@/components/Local/CheerPollCard',()=>({CheerPollCard:()=>null}));
jest.mock('@/components/Local/SearchResultsOverlay',()=>{
 const {Pressable,Text}=require('react-native');
 return {SearchResultsOverlay:({onSelectBooster}:any)=><Pressable accessibilityRole="button" accessibilityLabel="Select searched sponsor" onPress={()=>onSelectBooster('fixture-sponsor')}><Text>Fixture search result</Text></Pressable>};
});

it('keeps Games/Polls/Boosters visible and places sponsorship only in Boosters',async()=>{
 await render(<LocalTab/>);
 expect(screen.getByRole('tab',{name:'Games'})).toBeTruthy();
 await fireEvent.press(screen.getByRole('tab',{name:'Polls'}));
 expect(screen.getByRole('tab',{name:'Polls',selected:true})).toBeTruthy();
 expect(screen.queryByText('Fixture Community Sponsor')).toBeNull();
 expect(screen.queryByLabelText('+ Become a Team Sponsor')).toBeNull();
 await fireEvent.press(screen.getByRole('tab',{name:'Boosters'}));
 expect(screen.getByText('Fixture Community Sponsor')).toBeTruthy();
 expect(screen.getByLabelText('+ Become a Team Sponsor')).toBeTruthy();
});

it('opens Boosters when selecting a sponsor from search',async()=>{
 await render(<LocalTab/>);
 expect(screen.queryByRole('button',{name:'Select searched sponsor'})).toBeNull();
 await fireEvent(screen.getByLabelText('Search players, schools, or sponsors'), 'focus');
 await fireEvent.press(screen.getByRole('button',{name:'Select searched sponsor'}));
 expect(screen.queryByRole('button',{name:'Select searched sponsor'})).toBeNull();
 expect(screen.getByRole('tab',{name:'Boosters',selected:true})).toBeTruthy();
 expect(screen.getByText('Fixture Community Sponsor')).toBeTruthy();
});

it('keeps the sponsor action available with the Aura leaderboard disabled', async () => {
 mockLive.layouts.topBoosters=false; mockSponsors=[];
 await render(<LocalTab/>);
 await fireEvent.press(screen.getByRole('tab',{name:'Boosters'}));
 expect(screen.getByLabelText('+ Become a Team Sponsor')).toBeTruthy();
 expect(screen.queryByText('Aura rank fixture')).toBeNull();
});

it('keeps existing sponsors reachable with the sponsor action and Aura leaderboard disabled', async () => {
 mockLive.layouts.topBoosters=false; mockLive.layouts.sponsorshipModal=false;
 await render(<LocalTab/>);
 await fireEvent.press(screen.getByRole('tab',{name:'Boosters'}));
 expect(screen.getByText('Fixture Community Sponsor')).toBeTruthy();
 expect(screen.queryByLabelText('+ Become a Team Sponsor')).toBeNull();
 expect(screen.queryByText('Aura rank fixture')).toBeNull();
});

it('omits Boosters when all of its existing sources and actions are unavailable', async () => {
 mockLive.layouts.topBoosters=false; mockLive.layouts.sponsorshipModal=false; mockSponsors=[];
 await render(<LocalTab/>);
 expect(screen.queryByRole('tab',{name:'Boosters'})).toBeNull();
});

it('preserves published custom hub labels and their existing navigation destinations', async () => {
 mockLive.copy.localMatchesLabel='Tonight’s games'; mockLive.copy.localPollsLabel='School cheers'; mockLive.copy.localBoostersLabel='Our community';
 await render(<LocalTab/>);
 expect(screen.getByRole('tab',{name:'Tonight’s games',selected:true})).toBeTruthy();
 await fireEvent.press(screen.getByRole('tab',{name:'Our community'}));
 expect(screen.getByRole('tab',{name:'Our community',selected:true})).toBeTruthy();
 expect(screen.getByText('Fixture Community Sponsor')).toBeTruthy();
});

it('uses the shared section heading and one Local hub track', async () => {
  await render(<LocalTab/>);
  const heading = StyleSheet.flatten(screen.getByRole('header', { name: 'Live matchups' }).props.style);
  expect(heading.fontFamily).toBe(FONT.displayBold);
  expect(heading.borderLeftWidth).toBeUndefined();
  // The hub track is the Games tab's parent (a plain View tablist is not a queryable accessible element).
  expect(StyleSheet.flatten(screen.getByRole('tab', { name: 'Games' }).parent!.props.style).backgroundColor).toBe(FOCAL.mistJade);
});

// UX-19 follow-up M6/M8: single-line search keeps 14pt without a lineHeight (iOS clipping); headings sit 12pt above / 6pt below.
it('keeps the search input free of lineHeight and spaces the heading 12/6', async () => {
  await render(<LocalTab/>);
  const input = StyleSheet.flatten(screen.getByLabelText('Search players, schools, or sponsors').props.style);
  expect(input.fontSize).toBe(14);
  expect(input.lineHeight).toBeUndefined();
  expect(StyleSheet.flatten(screen.getByRole('header', { name: 'Live matchups' }).props.style)).toMatchObject({ marginTop: 4, marginBottom: -2 });
});
