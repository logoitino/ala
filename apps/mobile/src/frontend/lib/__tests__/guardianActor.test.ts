/** UX14 real SDK transport proves every existing guardian/privacy helper uses its optional captured client. */
import { supabase } from '@/lib/supabase';
import { createOfflineActorClient, type OfflineActorClient } from '@/lib/offlineActor';
import * as minors from '@/lib/minors';
import { fetchGuardianFunFacts, decideGuardianFunFact } from '@/lib/freshQuestions';
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: require('@supabase/supabase-js').createClient('https://guardian-test.invalid', 'public-test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) }));
const oldFetch = globalThis.fetch; const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL; const oldKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const consent = { signerName: 'Synthetic Guardian', relationship: 'parent' as const, allowsDonations: false, allowsPublicProfile: false };
let http: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
beforeEach(() => {
 process.env.EXPO_PUBLIC_SUPABASE_URL='https://guardian-test.invalid'; process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='public-test-key';
 jest.spyOn(supabase.auth,'getSession').mockResolvedValue({data:{session:{user:{id:'user-A'},access_token:'synthetic-A'}},error:null} as never);
 http=jest.fn<ReturnType<typeof fetch>,Parameters<typeof fetch>>(async url => new Response(JSON.stringify(String(url).endsWith('/guardian_list_minors') ? [] : { contract_version:5,profile_id:'minor-A',first_name:'Synthetic Teen',status:'ok',fact_id:'fact-A',facts:[],settings:{},summary:{},code:'AAAABBBB',expires_at:'2099-01-01' }),{headers:{'Content-Type':'application/json'}}));globalThis.fetch = http as unknown as typeof fetch;
});
afterEach(()=>{jest.restoreAllMocks();globalThis.fetch = oldFetch as unknown as typeof fetch; if(oldUrl===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=oldKey;});
it.each([
 ['guardian list',(c:OfflineActorClient)=>minors.fetchGuardianMinors(c)],
 ['preview',(c:OfflineActorClient)=>minors.previewGuardianInvite('AAAABBBB',c)],
 ['accept',(c:OfflineActorClient)=>minors.acceptGuardianInvite('AAAABBBB',consent,c)],
 ['sign',(c:OfflineActorClient)=>minors.signGuardianConsent('minor-A',consent,c)],
 ['revoke',(c:OfflineActorClient)=>minors.revokeGuardianConsent('minor-A',c)],
 ['summary',(c:OfflineActorClient)=>minors.fetchGuardianSupervision('minor-A',c)],
 ['approval',(c:OfflineActorClient)=>minors.decideApproval('request-A',true,c)],
 ['privacy read',(c:OfflineActorClient)=>minors.fetchMyPrivacyStatus(c)],
 ['privacy save',(c:OfflineActorClient)=>minors.saveMyPrivacyStatus({},c)],
 ['invite',(c:OfflineActorClient)=>minors.createGuardianInvite(c)],
 ['respond',(c:OfflineActorClient)=>minors.respondGuardianLink('link-A',true,c)],
 ['unlink',(c:OfflineActorClient)=>minors.endGuardianLink('link-A',c)],
 ['cancel approval',(c:OfflineActorClient)=>minors.cancelApprovalRequest('request-A',c)],
 ['own summary',(c:OfflineActorClient)=>minors.fetchMySupervision(c)],
 ['fun facts',(c:OfflineActorClient)=>fetchGuardianFunFacts(c)],
 ['fact decision',(c:OfflineActorClient)=>decideGuardianFunFact('fact-A',true,'guardian-profile-A',c)],
] as const)('%s keeps captured A instead of mutable global B',async(_label,run)=>{
 const client=await createOfflineActorClient({userId:'user-A',isCurrent:()=>true});
 jest.mocked(supabase.auth.getSession).mockResolvedValue({data:{session:{user:{id:'user-B'},access_token:'synthetic-B'}},error:null} as never);
 await run(client);expect(http.mock.calls.map(([,init])=>new Headers(init?.headers).get('Authorization'))).toEqual(['Bearer synthetic-A']);
});
