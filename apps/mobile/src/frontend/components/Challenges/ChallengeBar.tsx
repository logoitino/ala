/** CHAL-01a fixed self-report presets on eligible legacy workouts. No reply upload, ranking or cash. */
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { CHALLENGE_PRESETS,CHALLENGE_PRESET_LABEL,CHALLENGE_REASON_LABEL } from '@tapuai/shared-types/challenges';
import { fetchChallengeCounts,respondToChallenge,inviteFriendToChallenge,fetchChallengeFriends } from '@/lib/challenges';
import { useChallenges } from '@/hooks/useChallenges';
import { ChallengeButton,ChallengeFeedback } from './ChallengeControls';
import { COACH_LEVEL_BADGE, COACH_LEVEL_SHEET } from '@/lib/safetyLabels';
/** @purpose Root mounts only on the dedicated Beyond legacy workout list; active follows card/route focus.
 * A coach-level workout keeps the response buttons and shows the notice on the invite. Counsel has not required those invites to stop. */
export function ChallengeBar({reelId,active,coachLevel=false}:{reelId:string;active:boolean;coachLevel?:boolean}) {
 const read=useCallback((actor:string|null)=>fetchChallengeCounts(reelId,actor),[reelId]);
 const model=useChallenges(`post:${reelId}`,active,read,true);
 const [invitationKey,setInvitationKey]=useState<string|null>(null);
 const inviting=model.ready&&invitationKey===model.identityKey&&model.actorId!==null;
 const readFriends=useCallback(async(actor:string|null)=>{if(!actor)throw Error('Sign in to invite friends.');return fetchChallengeFriends(50,actor);},[]);
 const friendModel=useChallenges(`friends:${reelId}`,active&&inviting,readFriends);
 const disabled=model.busy||model.reading||!model.ready;
 const post=model.data;
 return <View><Text style={{fontWeight:'700'}}>Workout challenges</Text>
  <ChallengeFeedback error={model.error} notice={model.notice} reading={model.reading}/>
  {!model.canRead?<Text>Sign in to respond, or return when this workout is active.</Text>:null}
  <ChallengeButton label="Refresh workout challenges" disabled={!model.canRead||model.busy||model.reading} onPress={()=>void model.refresh()}/>
  {post&&!post.eligible?<Text>{post.reason?CHALLENGE_REASON_LABEL[post.reason]:'Challenges are unavailable on this workout.'}</Text>:null}
  {post?.eligible?<>
   {coachLevel?<Text>{`${COACH_LEVEL_BADGE}. ${COACH_LEVEL_SHEET}`}</Text>:null}
   <Text>Responses are self-reported. Join only if you want to; no exercise proof or cash reward.</Text>
   {!post.visible||post.total===null?<Text>Counts are hidden for privacy or a small group.</Text>:<Text>{post.total} responses</Text>}
   {post.canRespond&&model.actorId?CHALLENGE_PRESETS.map(preset=><ChallengeButton key={preset} label={CHALLENGE_PRESET_LABEL[preset]} selected={post.mine===preset} disabled={disabled} onPress={()=>void model.run(async actor=>{const next=await respondToChallenge(reelId,preset,actor);return next.badgeEarned?'Private Challenge finisher badge earned — self-reported and noncash.':'Response saved.';})}/>):null}
   {post.mine&&post.canRespond?<ChallengeButton label="Remove my response" disabled={disabled} onPress={()=>void model.run(async actor=>{await respondToChallenge(reelId,null,actor);return 'Response removed.';})}/>:null}
   {post.counts&&post.visible?CHALLENGE_PRESETS.map(preset=>post.counts![preset]===null?null:<Text key={preset}>{CHALLENGE_PRESET_LABEL[preset]}: {post.counts![preset]}</Text>):null}
   {post.canRespond&&model.actorId?<ChallengeButton label="Invite a friend" disabled={disabled} onPress={()=>setInvitationKey(model.identityKey)}/>:null}
  </>:null}
  {inviting?<View><Text>Up to 50 accepted friends. Requests may be muted; delivery is not confirmed.</Text>
   <ChallengeFeedback error={friendModel.error} notice={null} reading={friendModel.reading}/>
   {friendModel.error?<ChallengeButton label="Refresh accepted friends" disabled={friendModel.reading} onPress={()=>void friendModel.refresh()}/>:null}
   {friendModel.ready&&friendModel.data?.length===0?<Text>No accepted friends available. Manage friends in Profile privacy.</Text>:null}
   {friendModel.ready?friendModel.data?.map(friend=><ChallengeButton key={friend.profileId} label={`Invite ${friend.name}`} disabled={disabled} onPress={()=>void model.run(async actor=>{await inviteFriendToChallenge(reelId,friend.profileId,actor);return 'Invite request accepted. Delivery is not confirmed.';})}/>):null}
   <ChallengeButton label="Close friend choices" onPress={()=>setInvitationKey(null)}/>
  </View>:null}
 </View>;
}
