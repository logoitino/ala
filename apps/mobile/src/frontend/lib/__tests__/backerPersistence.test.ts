jest.mock('@/lib/stripe',()=>({createPaymentIntent:jest.fn()}));
/** Backer count completion requires a confirmed row and never retries a denied RPC as a raw write. */
const mockRpc=jest.fn(),mockUpdate=jest.fn();
jest.mock('@/lib/supabase',()=>({supabase:{rpc:(...args:unknown[])=>mockRpc(...args),from:()=>({update:()=>({eq:()=>({select:()=>({single:mockUpdate}),then:(resolve:(v:unknown)=>unknown,reject:(e:unknown)=>unknown)=>mockUpdate().then(resolve,reject)})})})}}));
import { incrementBackerCount } from '@/lib/payments';
import type { Player } from '@/types/database';
const player={id:'athlete',backer_count:3} as Player;
beforeEach(()=>{mockRpc.mockReset();mockUpdate.mockReset();});
it('does not use raw update after a permission refusal',async()=>{mockRpc.mockResolvedValue({data:null,error:{code:'42501',message:'Denied'}});mockUpdate.mockResolvedValue({data:null,error:null});await expect(incrementBackerCount(player)).rejects.toThrow('Denied');expect(mockUpdate).not.toHaveBeenCalled();});
it('rejects a zero-row legacy fallback',async()=>{mockRpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'Missing function'}});mockUpdate.mockResolvedValue({data:null,error:null});await expect(incrementBackerCount(player)).rejects.toThrow();});
it('returns the confirmed server count on a legacy fallback',async()=>{mockRpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'Missing function'}});mockUpdate.mockResolvedValue({data:{id:player.id,backer_count:8},error:null});await expect(incrementBackerCount(player)).resolves.toBe(8);});
