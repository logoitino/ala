/** GUEST-ACCESS-01 exercises the actual SDK58 root Stack screenLayout for direct guest URLs and callback isolation. */
import { useEffect } from 'react';
import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { GuestAccessBoundary } from '@/components/Auth/GuestAccessBoundary';
let mockMember=false;
const mockMounted=jest.fn();
jest.mock('@/context/AuthContext',()=>({useAuth:()=>({accountReady:mockMember,isGuest:!mockMember,session:mockMember?{user:{id:'member'}}:null,user:mockMember?{id:'member'}:null,loading:false,needsAgeConfirmation:false,birthPrompt:null,isSessionCurrent:()=>true})}));
jest.mock('@/context/SoftWallContext',()=>({useSoftWall:()=>({requireAuth:jest.fn(),close:jest.fn()})}));
jest.mock('@/components/Auth/GuestHighlightsPreview',()=>({GuestHighlightsPreview:()=>{const {Text}=require('react-native');return <Text>Bounded guest preview</Text>;}}));
jest.mock('@/components/UI/BrandMark',()=>({BrandMark:()=>null}));
function Protected(){useEffect(()=>{mockMounted();},[]);return <Text>Protected profile loaded</Text>;}
function Root(){return <Stack screenLayout={({children,route})=><GuestAccessBoundary authCallback={route.name==='auth/callback'}>{children}</GuestAccessBoundary>} screenOptions={{headerShown:false}} />;}
const routes={_layout:Root,index:Protected,'user/[id]':Protected,'auth/callback':()=> <Text>Auth callback completes</Text>};
beforeEach(()=>{mockMember=false;jest.clearAllMocks();});
it('direct guest profile URL never mounts its protected component and Back navigates to preview',async()=>{
 await renderRouter(routes,{initialUrl:'/user/target'});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Back to Highlights preview'})).toBeTruthy());
 expect(mockMounted).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole('button',{name:'Back to Highlights preview'}));
 await waitFor(()=>expect(screen.getByText('Bounded guest preview')).toBeTruthy());expect(mockMounted).not.toHaveBeenCalled();
});
it('registered account direct URL mounts the existing protected component',async()=>{mockMember=true;await renderRouter(routes,{initialUrl:'/user/target'});await waitFor(()=>expect(screen.getByText('Protected profile loaded')).toBeTruthy());expect(mockMounted).toHaveBeenCalledTimes(1);});
it('the callback exemption applies to the actual callback screen',async()=>{await renderRouter(routes,{initialUrl:'/auth/callback'});await waitFor(()=>expect(screen.getByText('Auth callback completes')).toBeTruthy());expect(mockMounted).not.toHaveBeenCalled();});
