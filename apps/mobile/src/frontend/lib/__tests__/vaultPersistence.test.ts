/** Vault lock success must be stored, with missing-schema fallback kept distinct from access refusal. */
import { setPlayerVaultLocked } from '@/lib/vault';
const mockRpc=jest.fn(),mockUpdate=jest.fn();
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:true,supabase:{rpc:(...args:unknown[])=>mockRpc(...args),from:()=>({update:()=>({eq:()=>({select:()=>({single:mockUpdate})})})})}}));
beforeEach(()=>{mockRpc.mockReset();mockUpdate.mockReset();});
it('rejects a denied lock change without a table-write fallback',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{code:'42501',message:'Denied'}});
 mockUpdate.mockResolvedValue({error:{message:'Denied'}});
 await expect(setPlayerVaultLocked('player',false)).rejects.toThrow('Denied');
 expect(mockUpdate).not.toHaveBeenCalled();
});
it('rejects a failed missing-function fallback instead of returning the requested flag',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'Missing function'}});
 mockUpdate.mockResolvedValue({error:{message:'Could not save'}});
 await expect(setPlayerVaultLocked('player',false)).rejects.toThrow('Could not save');
});
it('retains confirmed server lock value',async()=>{mockRpc.mockResolvedValue({data:true,error:null});await expect(setPlayerVaultLocked('player',false)).resolves.toBe(true);});

it('rejects a zero-row privacy UPDATE instead of pretending the lock persisted',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'Missing function'}});
 mockUpdate.mockResolvedValue({data:null,error:null});
 await expect(setPlayerVaultLocked('player',false)).rejects.toThrow();
});
