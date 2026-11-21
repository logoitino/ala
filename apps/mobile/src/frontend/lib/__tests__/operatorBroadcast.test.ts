/** Retained and one-shot callouts must join the fan receiver's private admission namespace. No live send. */
const mockSend=jest.fn(async()=>({}));
const mockChannel=jest.fn((_topic:string,_options:unknown)=>({subscribe:(callback?: (status:string)=>void)=>{callback?.('SUBSCRIBED');},send:mockSend}));
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:true,supabase:{channel:(topic:string,options:unknown)=>mockChannel(topic,options),removeChannel:jest.fn()}}));
import { openGameEventsBroadcaster, sendGameEventBroadcast } from '@/lib/operator';
it('uses private admission for both send paths so normal callouts reach private fan receivers',async()=>{
 const payload={} as never;
 const retained=openGameEventsBroadcaster('game-A');
 await retained?.send(payload);retained?.close();
 await sendGameEventBroadcast('game-A',payload);
 expect(mockChannel.mock.calls).toEqual([
 ['game_events_game-A',{config:{broadcast:{ack:true},private:true}}],
 ['game_events_game-A',{config:{broadcast:{ack:true},private:true}}],
 ]);
 expect(mockSend).toHaveBeenCalledTimes(2);
});
