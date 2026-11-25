/** GUEST-ACCESS-01 synthetic injected session lookups must not promote anonymous identities into account API actions. */
import { resolveSession } from '../../../../../supabase/functions/_shared/money/session.ts';
it('refuses a live anonymous-auth user',async()=>{const result=await resolveSession('synthetic-token',{getUser:async()=>({user:{id:'anonymous',is_anonymous:true},error:null})});expect(result.ok).toBe(false);});
it('refuses a locally verified anonymous-auth claim',async()=>{const result=await resolveSession('synthetic-token',{getUser:async()=>({user:{id:'account'},error:null}),verifyLocally:async()=>({outcome:'verified',claims:{sub:'anonymous',role:'authenticated',is_anonymous:true}} as any)});expect(result.ok).toBe(false);});
it('retains an existing real account decision',async()=>{const result=await resolveSession('synthetic-token',{getUser:async()=>({user:{id:'account',is_anonymous:false},error:null})});expect(result.ok).toBe(true);});
