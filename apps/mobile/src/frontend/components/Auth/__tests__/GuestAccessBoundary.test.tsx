/** GUEST-ACCESS-01 checks denial before child effects and session/age recovery across web and phone. */
import { useEffect } from 'react';
import { Text, Platform } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { GuestAccessBoundary } from '@/components/Auth/GuestAccessBoundary';
const originalOS=Platform.OS;
afterEach(()=>Object.defineProperty(Platform,'OS',{configurable:true,value:originalOS}));
let mockPath='/',mockAuth:any;
const mockReplace=jest.fn(),mockRequire=jest.fn(),mockClose=jest.fn(),mockMount=jest.fn(),mockUnmount=jest.fn();
jest.mock('expo-router',()=>({usePathname:()=>mockPath,useRouter:()=>({replace:mockReplace})}));
jest.mock('@/context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('@/context/SoftWallContext',()=>({useSoftWall:()=>({requireAuth:mockRequire,close:mockClose})}));
jest.mock('@/components/Auth/GuestHighlightsPreview',()=>({GuestHighlightsPreview:()=> { const {Text}=require('react-native');return <Text>Guest preview</Text>; }}));
jest.mock('@/components/UI/BrandMark',()=>({BrandMark:()=>null}));
function PrivateChild(){useEffect(()=>{mockMount();return()=>{mockUnmount();};},[]);return <Text>Private profile data</Text>;}
const account=()=>({accountReady:true,isGuest:false,session:{user:{id:'one'}},user:{id:'one'},loading:false,needsAgeConfirmation:false,birthPrompt:null,isSessionCurrent:()=>true});
beforeEach(()=>{mockPath='/user/athlete';mockAuth={...account(),isGuest:true,session:null,user:null};jest.clearAllMocks();});
it.each(['web','ios','android'])('does not mount restricted child effects on %s',async(os)=>{
 Object.defineProperty(Platform,'OS',{configurable:true,value:os});
 await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);
 expect(mockMount).not.toHaveBeenCalled();expect(screen.queryByText('Private profile data')).toBeNull();
 expect(screen.getByRole('button',{name:'Sign in or create an account'})).toBeTruthy();
});
it('guest Home mounts only the bounded preview',async()=>{mockPath='/';await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(screen.getByText('Guest preview')).toBeTruthy();expect(mockMount).not.toHaveBeenCalled();});
it('auth callback remains mounted to finish sign-in even during restoration',async()=>{mockPath='/auth/callback';mockAuth.loading=true;await render(<GuestAccessBoundary authCallback><PrivateChild /></GuestAccessBoundary>);expect(mockMount).toHaveBeenCalledTimes(1);});
it('restoration and stale sessions never expose private children',async()=>{mockAuth.loading=true;const v=await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(mockMount).not.toHaveBeenCalled();mockAuth={...account(),isSessionCurrent:()=>false};await v.rerender(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(mockMount).not.toHaveBeenCalled();});
it('sign-in keeps the destination gated until age confirmation finishes',async()=>{
 const v=await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);
 await fireEvent.press(screen.getByRole('button',{name:'Sign in or create an account'}));expect(mockRequire).toHaveBeenCalledWith(expect.objectContaining({kind:'browse',resume:expect.any(Function)}));
 mockAuth={...account(),needsAgeConfirmation:true};await v.rerender(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(mockMount).not.toHaveBeenCalled();
 mockAuth=account();await v.rerender(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(mockMount).toHaveBeenCalledTimes(1);
});
it('sign-out discards private mounted UI and cancellation returns to preview',async()=>{
 mockAuth=account();const v=await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);
 mockAuth={...account(),isGuest:true,session:null,user:null};await v.rerender(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);
 expect(mockUnmount).toHaveBeenCalledTimes(1);expect(screen.queryByText('Private profile data')).toBeNull();
 await fireEvent.press(screen.getByRole('button',{name:'Back to Highlights preview'}));expect(mockClose).toHaveBeenCalledTimes(1);expect(mockReplace).toHaveBeenCalledWith('/');
});
it('a uid in an anonymous-auth session does not unlock the screen',async()=>{mockAuth={...account(),session:{user:{id:'one',is_anonymous:true}}};await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(mockMount).not.toHaveBeenCalled();});
it('changing account owner remounts private children instead of retaining another account state',async()=>{mockAuth=account();const v=await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);mockAuth={...account(),user:{id:'two'},session:{user:{id:'two'}}};await v.rerender(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(mockUnmount).toHaveBeenCalledTimes(1);expect(mockMount).toHaveBeenCalledTimes(2);});

it('a different active auth callback cannot exempt a retained private screen',async()=>{mockPath='/auth/callback';await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(mockMount).not.toHaveBeenCalled();});

it('does not mount a destination before profile eligibility is known and offers recovery',async()=>{mockAuth={...account(),accountReady:false,refreshProfile:jest.fn(),signOut:jest.fn()};await render(<GuestAccessBoundary><PrivateChild /></GuestAccessBoundary>);expect(mockMount).not.toHaveBeenCalled();await fireEvent.press(screen.getByRole('button',{name:'Retry account setup'}));expect(mockAuth.refreshProfile).toHaveBeenCalledTimes(1);});

it('published Home pause stops mounting the public preview',async()=>{mockPath='/';await render(<GuestAccessBoundary previewEnabled={false}><PrivateChild /></GuestAccessBoundary>);expect(screen.queryByText('Guest preview')).toBeNull();expect(screen.getByText('Highlights will be back soon')).toBeTruthy();expect(mockMount).not.toHaveBeenCalled();});
