/** Legacy discovery boundary: actual named actor and bounded minimal records, no raw media/profile payload. */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({isSupabaseConfigured:true,supabase:{rpc:(...args:unknown[])=>mockRpc(...args)}}));
import {fetchBeyondLegacyPosts} from '@/lib/beyondLegacy';
const row={id:'r1',title:'Footwork',player_id:'p1',athlete_name:'Mele',category:'workout'};
it('binds canonical actor and clamps discovery, preserving only the small card contract',async()=>{
 mockRpc.mockResolvedValue({data:[{...row,video_url:'private',full_profile:'private'}],error:null});
 await expect(fetchBeyondLegacyPosts('a','workout',1000)).resolves.toEqual([{id:'r1',title:'Footwork',playerId:'p1',athleteName:'Mele',category:'workout'}]);
 expect(mockRpc).toHaveBeenLastCalledWith('beyond_legacy_posts',{expected_actor_id:'a',category:'workout',max_rows:24});
 mockRpc.mockResolvedValueOnce({data:[{...row,category:'service'}],error:null});
 await fetchBeyondLegacyPosts(null,'service',NaN);expect(mockRpc).toHaveBeenLastCalledWith('beyond_legacy_posts',{expected_actor_id:null,category:'service',max_rows:24});
});
it('rejects malformed, cross-category or oversized source and exposes migration absence',async()=>{
 for(const data of [null,{},[{...row,player_id:''}],[{...row,category:'service'}],Array(25).fill(row)]){
  mockRpc.mockResolvedValueOnce({data,error:null});await expect(fetchBeyondLegacyPosts('a','workout')).rejects.toThrow(/unavailable data/i);
 }
 mockRpc.mockResolvedValueOnce({data:null,error:{code:'PGRST202',message:'missing'}});await expect(fetchBeyondLegacyPosts('a','workout')).rejects.toThrow(/database update has not been applied/i);
});

it('accepts the server codepoint caps for emoji and rejects genuinely overlong names',async()=>{
 mockRpc.mockResolvedValueOnce({data:[{...row,title:'🏈'.repeat(240),athlete_name:'🏀'.repeat(160)}],error:null});
 await expect(fetchBeyondLegacyPosts('a','workout')).resolves.toHaveLength(1);
 mockRpc.mockResolvedValueOnce({data:[{...row,athlete_name:'🏀'.repeat(161)}],error:null});
 await expect(fetchBeyondLegacyPosts('a','workout')).rejects.toThrow(/unavailable data/i);
});

// Exact actual local PostgreSQL responses, synthetic seed; original fixture SHA8a4c8bec5c3128d115fd839d0ab37cb5650e2a5052b021977b84a96ddfed8f9e.
const actualPgResponses={"workout": [{"id": "00000000-0000-0000-0000-000000000901", "title": "Legacy work", "category": "workout", "player_id": "00000000-0000-0000-0000-000000000851", "athlete_name": "Exact legacyAth"}], "service": [{"id": "00000000-0000-0000-0000-000000000902", "title": "Legacy service", "category": "service", "player_id": "00000000-0000-0000-0000-000000000851", "athlete_name": "Exact legacyAth"}]};
it('accepts actual PostgreSQL category/projection responses for both discovery paths',async()=>{
 for(const category of ['workout','service'] as const){mockRpc.mockResolvedValueOnce({data:actualPgResponses[category],error:null});const [post]=await fetchBeyondLegacyPosts(null,category);expect(post.category).toBe(category);expect(post.playerId).toBe(actualPgResponses[category][0].player_id);}
});
