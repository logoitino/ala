/** Real legacy card/hook integration masks outgoing reads and uses the established athlete support route. */
import {act,render,screen,fireEvent,waitFor} from '@testing-library/react-native';
import {AppState} from 'react-native';
import {LegacyWorkoutList} from '../LegacyWorkoutList';
const mockRead=jest.fn(),mockPush=jest.fn();let mockAuth:any,mockFocused=true;
jest.mock('@/context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('@/lib/beyondLegacy',()=>({fetchBeyondLegacyPosts:(...args:unknown[])=>mockRead(...args)}));
jest.mock('expo-router',()=>({useRouter:()=>({push:mockPush}),useFocusEffect:(fn:()=>void)=>require('react').useEffect(()=>mockFocused?fn():undefined,[fn,mockFocused])}));
jest.mock('@/components/Challenges/ChallengeBar',()=>({ChallengeBar:()=>null}));
const A={user:{id:'ua'},profile:{id:'a',user_id:'ua'},loading:false};
const row={id:'r1',title:'Footwork',playerId:'p1',athleteName:'Mele',category:'workout'};
beforeEach(()=>{mockAuth=A;mockFocused=true;mockRead.mockReset().mockResolvedValue([row]);mockPush.mockReset();Object.defineProperty(AppState,'currentState',{configurable:true,value:'active'});jest.spyOn(AppState,'addEventListener').mockReturnValue({remove:jest.fn()});});
afterEach(()=>jest.restoreAllMocks());
it('shows a bounded workout invitation and keeps viewing/support on the real athlete route',async()=>{
 await render(<LegacyWorkoutList category="workout" active/>);await waitFor(()=>expect(screen.getByText('Footwork')).toBeTruthy());
 expect(mockRead).toHaveBeenLastCalledWith('a','workout',24);
 await fireEvent.press(screen.getByRole('button',{name:'View Mele’s athlete profile'}));expect(mockPush).toHaveBeenCalledWith('/user/p1');
});
it('discards an outgoing read and masks cards when route loses focus',async()=>{
 let resolve!:(value:unknown)=>void;mockRead.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
 const ui=await render(<LegacyWorkoutList category="workout" active/>);
 mockAuth={user:{id:'ub'},profile:{id:'b',user_id:'ub'},loading:false};await ui.rerender(<LegacyWorkoutList category="workout" active/>);
 await waitFor(()=>expect(screen.getByText('Footwork')).toBeTruthy());await act(async()=>resolve([{...row,title:'Old private A'}]));expect(screen.queryByText('Old private A')).toBeNull();
 mockFocused=false;await ui.rerender(<LegacyWorkoutList category="workout" active/>);expect(screen.queryByText('Footwork')).toBeNull();
});
it('keeps source failures visible and does not fetch learning or story as workouts',async()=>{
 mockRead.mockRejectedValueOnce(new Error('Database update not applied'));
 const ui=await render(<LegacyWorkoutList category="service" active/>);await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
 expect(screen.queryByText('No athlete clips in this page.')).toBeNull();
 await ui.rerender(<LegacyWorkoutList category="learning" active/>);expect(mockRead).toHaveBeenCalledTimes(1);
});

it('rejects a retained profile button after account ABA and still opens a current profile',async()=>{
 const ui=await render(<LegacyWorkoutList category="workout" active/>);await waitFor(()=>expect(screen.getByText('Footwork')).toBeTruthy());
 const node=screen.getByRole('button',{name:'View Mele’s athlete profile'});
 let fiber=node.unstable_fiber as unknown as {memoizedProps?:{onPress?:()=>void};return?:unknown}|null;let old:(()=>void)|undefined;
 for(let depth=0;fiber&&depth<30;depth++,fiber=fiber.return as typeof fiber){if(typeof fiber.memoizedProps?.onPress==='function'){old=fiber.memoizedProps.onPress;break;}}
 if(!old)throw Error('No press callback found');
 mockAuth={user:{id:'ub'},profile:{id:'b',user_id:'ub'},loading:false};await ui.rerender(<LegacyWorkoutList category="workout" active/>);await waitFor(()=>expect(mockRead).toHaveBeenCalledTimes(2));
 mockAuth=A;await ui.rerender(<LegacyWorkoutList category="workout" active/>);await waitFor(()=>expect(mockRead).toHaveBeenCalledTimes(3));
 await act(async()=>old!());expect(mockPush).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole('button',{name:'View Mele’s athlete profile'}));expect(mockPush).toHaveBeenCalledWith('/user/p1');
});
