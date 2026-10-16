/** CHAL-01 Activity-only invitations; no push, direct messaging or unverified Watch deep link. */
import { useCallback } from 'react';
import { Text,View } from 'react-native';
import { challengeInviteText } from '@tapuai/shared-types/challenges';
import { fetchChallengeInbox,fetchMyChallengeStatus,setChallengeMute } from '@/lib/challenges';
import { useChallenges } from '@/hooks/useChallenges';
import { ChallengeButton,ChallengeFeedback } from './ChallengeControls';
/** @purpose Own current invitations and sender/all mute controls on Activity. */
export function ChallengeInbox({active=true}:{active?:boolean}) {
 const read=useCallback(async(actor:string|null)=>{if(!actor)throw Error('Sign in to read challenge invites.');const [inbox,status]=await Promise.all([fetchChallengeInbox(30,actor),fetchMyChallengeStatus(actor)]);return {inbox,status};},[]);
 const model=useChallenges('inbox',active,read);
 const disabled=model.busy||model.reading||!model.ready;
 return <View><Text style={{fontWeight:'700'}}>Challenge invites</Text><ChallengeFeedback error={model.error} notice={model.notice} reading={model.reading}/>
  {!model.canRead?<Text>Sign in to manage your challenge invites.</Text>:null}
  {model.canRead?<ChallengeButton label="Refresh challenge invites" disabled={model.busy||model.reading} onPress={()=>void model.refresh()}/>:null}
  {model.data?<>
   {!model.data.status.enabled?<Text>Workout challenges are paused. You can still manage mutes in your settings.</Text>:null}
   {model.data.status.enabled&&model.data.inbox.length===0?<Text>No challenge invites in the current 30-day inbox.</Text>:null}
   {model.data.inbox.map(invite=><View key={invite.id}><Text>{challengeInviteText(invite)}</Text><Text>Workout invitation. Find permitted workouts in Beyond the Game.</Text><ChallengeButton label={`Mute invites from ${invite.senderName}`} disabled={disabled} onPress={()=>void model.run(async actor=>{await setChallengeMute(invite.senderId,true,actor);return 'Invites from this person are muted.';})}/></View>)}
   <ChallengeButton label={model.data.status.mutedAll?'Allow challenge invites again':'Mute all challenge invites'} disabled={disabled} onPress={()=>void model.run(async actor=>{await setChallengeMute(null,!model.data!.status.mutedAll,actor);return model.data!.status.mutedAll?'All-invite mute removed.':'All challenge invites muted.';})}/>
  </>:null}
 </View>;
}
