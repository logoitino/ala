/** Catalog usage includes secondary participation and does not count only athletes with career totals. */
const mockRpc=jest.fn();const mockFrom=jest.fn();
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:true,supabase:{rpc:(...args:unknown[])=>mockRpc(...args),from:(...args:unknown[])=>mockFrom(...args)}}));
import{fetchSportUsage}from '@/lib/sports';
it('counts profile-owned secondary sports from the protected aggregate',async()=>{
 mockRpc.mockResolvedValue({data:[{sport:'Volleyball',athletes:2}],error:null});
 mockFrom.mockReturnValue({select:()=>({limit:()=>Promise.resolve({data:[{sport:'Volleyball'}],error:null})})});
 await expect(fetchSportUsage()).resolves.toEqual({volleyball:{athletes:2,games:1}});
});
