/** GUEST-ACCESS-01 guest reads have one bounded sanitized RPC and never recover into full roster/feed queries. */
import { fetchGuestHighlightPreview } from '@/lib/guestPreview';
let mockConfigured=true;
const mockPublicClient={rpc:jest.fn()};
const mockRpc=jest.fn(),mockFrom=jest.fn();
jest.mock('@/lib/supabase',()=>({get isSupabaseConfigured(){return mockConfigured;},getGuestPreviewClient:()=>mockPublicClient,supabase:{from:mockFrom}}));
jest.mock('@/lib/rpc',()=>({untypedRpc:(...args:unknown[])=>mockRpc(...args)}));
jest.mock('@/lib/reels',()=>({resolvePlaybackUrl:async(url:string)=>url}));
const clip={id:'00000000-0000-4000-8000-000000006001',title:'Safe preview',video_url:'https://example.invalid/clip.mp4',created_at:'2026-11-25T00:00:00Z'};
beforeEach(()=>{jest.clearAllMocks();mockConfigured=true;mockRpc.mockResolvedValue({data:[clip],error:null});});
it('reads only the no-argument preview RPC',async()=>{expect(await fetchGuestHighlightPreview()).toEqual([clip]);expect(mockRpc).toHaveBeenCalledWith('guest_highlights_preview',{},mockPublicClient);expect(mockFrom).not.toHaveBeenCalled();});
it('missing migration rejects without full feed or roster fallback',async()=>{mockRpc.mockResolvedValue({data:null,error:{code:'42883',message:'missing'}});await expect(fetchGuestHighlightPreview()).rejects.toThrow('preview');expect(mockFrom).not.toHaveBeenCalled();});
it.each([{rows:[{...clip,player_id:'private'}]},{rows:Array(4).fill(clip)},{rows:[{...clip,video_url:'vault://private'}]}])('rejects unbounded or widened preview records',async({rows})=>{mockRpc.mockResolvedValue({data:rows,error:null});await expect(fetchGuestHighlightPreview()).rejects.toThrow('preview');expect(mockFrom).not.toHaveBeenCalled();});
it('unconfigured source is unavailable rather than a fabricated empty feed',async()=>{mockConfigured=false;await expect(fetchGuestHighlightPreview()).rejects.toThrow('preview');expect(mockRpc).not.toHaveBeenCalled();});
