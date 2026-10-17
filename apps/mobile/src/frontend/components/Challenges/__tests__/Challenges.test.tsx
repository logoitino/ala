/** CHAL-01 actual participant controls with synthetic SDK records; no production mounts. */
import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/challenges';
import { exportCsv } from '@/lib/csvExport';
import * as controls from '@/components/Challenges/ChallengeControls';
import { ChallengeBar } from '@/components/Challenges/ChallengeBar';
import { ChallengeInbox } from '@/components/Challenges/ChallengeInbox';
import { ChallengeSettings } from '@/components/Challenges/ChallengeSettings';
jest.mock('@/context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('expo-router',()=>({useFocusEffect:(callback:()=>void)=>require('react').useEffect(callback,[callback])}));
jest.mock('@/lib/csvExport',()=>({exportCsv:jest.fn()}));
jest.mock('@/lib/challenges',()=>({fetchChallengeFriends:jest.fn(),fetchChallengeCounts:jest.fn(),respondToChallenge:jest.fn(),inviteFriendToChallenge:jest.fn(),fetchChallengeInbox:jest.fn(),fetchMyChallengeStatus:jest.fn(),setChallengeMute:jest.fn(),setAllowChallenges:jest.fn(),exportMyChallengeData:jest.fn()}));
const apiMock=jest.mocked(api),friends=apiMock.fetchChallengeFriends,download=jest.mocked(exportCsv);
const A={user:{id:'11111111-1111-4111-8111-111111111111'},profile:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:'11111111-1111-4111-8111-111111111111'},loading:false};
const B={user:{id:'22222222-2222-4222-8222-222222222222'},profile:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:'22222222-2222-4222-8222-222222222222'},loading:false};
const auth=(v:typeof A)=>jest.mocked(useAuth).mockReturnValue(v as ReturnType<typeof useAuth>);
const counts={enabled:true,eligible:true,reason:null,visible:false,counts:null,total:null,mine:null,canRespond:true,badgeEarned:false} as const;
const status={enabled:true,isAthlete:true,allowChallenges:false,allowDefault:false,allowSet:false,mutedAll:false,mutedSenders:[{profileId:'friend1',name:'Mele'}],badges:[{badge:'challenge_finisher' as const,earnedAt:'2026-10-16T00:00:00Z'}]};
beforeEach(()=>{jest.clearAllMocks();auth(A);Object.defineProperty(AppState,'currentState',{configurable:true,value:'active'});apiMock.fetchChallengeCounts.mockResolvedValue(counts);apiMock.respondToChallenge.mockResolvedValue({...counts,mine:'did_it',badgeEarned:true});apiMock.inviteFriendToChallenge.mockResolvedValue({sentToday:1,dailyLimit:5});apiMock.fetchChallengeInbox.mockResolvedValue([{id:'n1',reelId:'r1',senderId:'friend1',senderName:'Mele',athleteName:'Sione',createdAt:'2026-10-16'}]);apiMock.fetchMyChallengeStatus.mockResolvedValue(status);apiMock.setAllowChallenges.mockResolvedValue({...status,allowChallenges:true});apiMock.setChallengeMute.mockResolvedValue(status);friends.mockResolvedValue([{profileId:'friend1',name:'Mele'}]);apiMock.exportMyChallengeData.mockResolvedValue({response_quota:[],responses:[{reel_id:'r1',preset:'did_it'}],invites_sent:[],invites_received:[],mutes:[],badges:[],athlete_setting:null});download.mockResolvedValue('downloaded');});
it('hides small/private counts while preserving permitted presets and self-report private badge copy',async()=>{
 await render(<ChallengeBar reelId="r1" active/>);await screen.findByLabelText('Did it! 💪');expect(screen.getByText(/Counts are hidden/)).toBeTruthy();expect(screen.queryByText('0 responses')).toBeNull();
 await fireEvent.press(screen.getByLabelText('Did it! 💪'));expect(apiMock.respondToChallenge).toHaveBeenCalledWith('r1','did_it',A.profile.id);expect(await screen.findByText(/Private Challenge finisher badge earned/)).toBeTruthy();
 expect(screen.getByText(/Responses are self-reported/)).toBeTruthy();
});
it('loads friends only after an explicit invite choice and never promises delivery',async()=>{
 await render(<ChallengeBar reelId="r1" active/>);await screen.findByLabelText('Invite a friend');expect(friends).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByLabelText('Invite a friend'));await screen.findByLabelText('Invite Mele');expect(friends).toHaveBeenCalledWith(50,A.profile.id);expect(screen.getByText(/Up to 50 accepted friends/)).toBeTruthy();
 await fireEvent.press(screen.getByLabelText('Invite Mele'));expect(apiMock.inviteFriendToChallenge).toHaveBeenCalledWith('r1','friend1',A.profile.id);expect(await screen.findByText(/Invite request accepted/)).toBeTruthy();expect(screen.queryByText(/was delivered|has seen|will see/)).toBeNull();
});
it('shows removed/denied workout states without response or invitation controls',async()=>{
 apiMock.fetchChallengeCounts.mockResolvedValue({...counts,eligible:false,reason:'not_listed',canRespond:false});await render(<ChallengeBar reelId="removed" active/>);await screen.findByText(/Not on Highlights/);expect(screen.queryByLabelText('Did it! 💪')).toBeNull();expect(screen.queryByLabelText('Invite a friend')).toBeNull();
});
it('clears old target invite choices on actor change',async()=>{
 const view=await render(<ChallengeBar reelId="r1" active/>);await fireEvent.press(await screen.findByLabelText('Invite a friend'));await screen.findByLabelText('Invite Mele');
 auth(B);await view.rerender(<ChallengeBar reelId="r1" active/>);expect(screen.queryByLabelText('Invite Mele')).toBeNull();await waitFor(()=>expect(apiMock.fetchChallengeCounts).toHaveBeenLastCalledWith('r1',B.profile.id));
});
it('inbox uses truthful workout context/mute and no fake Watch destination',async()=>{
 await render(<ChallengeInbox/>);expect(await screen.findByText("Mele invited you to try Sione's workout")).toBeTruthy();expect(screen.queryByLabelText(/Watch/)).toBeNull();
 await fireEvent.press(screen.getByLabelText('Mute invites from Mele'));expect(apiMock.setChallengeMute).toHaveBeenCalledWith('friend1',true,A.profile.id);expect(await screen.findByText(/Invites from this person are muted/)).toBeTruthy();
});
it('a missing database update stays off the fan inbox',async()=>{
 apiMock.fetchChallengeInbox.mockRejectedValueOnce(Error('This control is not switched on yet: its database update has not been applied.'));
 await render(<ChallengeInbox/>);await waitFor(()=>expect(screen.queryByText('Challenge invites')).toBeNull());
 expect(screen.queryByText(/database update has not been applied/)).toBeNull();
});
it('inbox errors clear private entries and allow a real refresh rather than showing empty success',async()=>{
 const view=await render(<ChallengeInbox/>);await screen.findByText(/Mele invited/);apiMock.fetchChallengeInbox.mockRejectedValueOnce(Error('Inbox source unavailable'));
 await fireEvent.press(screen.getByLabelText('Refresh challenge invites'));expect(await screen.findByText('Inbox source unavailable')).toBeTruthy();expect(screen.queryByText(/Mele invited/)).toBeNull();expect(screen.queryByText(/No challenge invites/)).toBeNull();
 await fireEvent.press(screen.getByLabelText('Refresh challenge invites'));await screen.findByText(/Mele invited/);await view.unmount();
});
it('settings keeps badge private, uses actor-bound toggle/mutes and exports only on explicit request',async()=>{
 await render(<ChallengeSettings/>);await screen.findByText('Challenge finisher');expect(screen.getByText(/Private.*noncash/)).toBeTruthy();expect(apiMock.exportMyChallengeData).not.toHaveBeenCalled();expect(screen.queryByText('reel_id')).toBeNull();
 await fireEvent.press(screen.getByLabelText('Allow challenges on my workouts'));expect(apiMock.setAllowChallenges).toHaveBeenCalledWith(true,A.profile.id);await screen.findByLabelText('Export my challenge data');
 await fireEvent.press(screen.getByLabelText('Export my challenge data'));await waitFor(()=>expect(download).toHaveBeenCalled());expect(apiMock.exportMyChallengeData).toHaveBeenCalledWith(A.profile.id);expect(download.mock.calls[0][0]).toBe('tapuai-challenges.csv');expect(download.mock.calls[0][1]).toContain('reel_id');expect(await screen.findByText('Challenge data downloaded.')).toBeTruthy();
});
it('does not export an outgoing account reply or expose old badge after account switch',async()=>{
 let resolve!:(v:Record<string,unknown>)=>void;apiMock.exportMyChallengeData.mockReturnValueOnce(new Promise(r=>{resolve=r;}));const view=await render(<ChallengeSettings/>);await fireEvent.press(await screen.findByLabelText('Export my challenge data'));
 apiMock.fetchMyChallengeStatus.mockResolvedValueOnce({...status,badges:[]});auth(B);await view.rerender(<ChallengeSettings/>);expect(screen.queryByText('Challenge finisher')).toBeNull();await act(async()=>resolve({responses:[{secret:'A'}]}));expect(download).not.toHaveBeenCalled();
});

it('retained preset/refresh/invite callbacks cannot mutate or reread across actor and target lifetimes',async()=>{
 const original=controls.ChallengeButton;const callbacks=new Map<string,()=>void>();
 const spy=jest.spyOn(controls,'ChallengeButton').mockImplementation(props=>{callbacks.set(props.label,props.onPress);return createElement(original,props);});
 const view=await render(<ChallengeBar reelId="r1" active/>);await screen.findByLabelText('Did it! 💪');
 const preset=callbacks.get('Did it! 💪')!,refresh=callbacks.get('Refresh workout challenges')!,invite=callbacks.get('Invite a friend')!;
 auth(B);await view.rerender(<ChallengeBar reelId="r2" active/>);await waitFor(()=>expect(apiMock.fetchChallengeCounts).toHaveBeenLastCalledWith('r2',B.profile.id));
 const reads=apiMock.fetchChallengeCounts.mock.calls.length;
 await act(async()=>{preset();refresh();invite();});expect(apiMock.respondToChallenge).not.toHaveBeenCalled();expect(apiMock.fetchChallengeCounts).toHaveBeenCalledTimes(reads);expect(friends).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByLabelText('Did it! 💪'));expect(apiMock.respondToChallenge).toHaveBeenCalledWith('r2','did_it',B.profile.id);
 await view.unmount();spy.mockRestore();
});
