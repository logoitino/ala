/** Existing athlete discovery keeps support on profiles; UX-06 presentation preserves every navigation lifetime check. */
import {useEffect,useRef,useCallback} from 'react';
import {Text,View,AppState,Platform} from 'react-native';
import {useRouter,useFocusEffect} from 'expo-router';
import type {BeyondCategory} from '@tapuai/shared-types/beyondGame';
import {useBeyondLegacyClips} from '@/hooks/useBeyondLegacyClips';
import {userProfileHref} from '@/lib/navigation';
import {ChallengeBar} from '@/components/Challenges/ChallengeBar';
import {BeyondButton} from './BeyondGameComposer';
import {beyondStyles as styles} from './BeyondGameStyles';
export function LegacyWorkoutList({category,active}:{category:BeyondCategory;active:boolean}) {
 const model=useBeyondLegacyClips(category,active),router=useRouter();
 // A profile button captures the current read lifetime; an old button must not revive after A → B → A.
 const scope=useRef({key:model.identityKey,version:model.version,ready:model.ready,epoch:0});
 if(scope.current.key!==model.identityKey||scope.current.version!==model.version||scope.current.ready!==model.ready)
  scope.current={key:model.identityKey,version:model.version,ready:model.ready,epoch:scope.current.epoch+1};
 const captured=scope.current;
 const invalidate=useCallback(()=>{scope.current={...scope.current,key:null,epoch:scope.current.epoch+1};},[]);
 useFocusEffect(useCallback(()=>invalidate,[invalidate]));
 useEffect(()=>{
  const subscription=AppState.addEventListener('change',state=>{if(state!=='active')invalidate();});
  const hidden=()=>{if(document.hidden)invalidate();};
  if(Platform.OS==='web'&&typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
  return()=>{invalidate();subscription.remove();if(Platform.OS==='web'&&typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);};
 },[invalidate]);
 const openProfile=(playerId:string)=>{
  if(!active||!captured.ready||!captured.key||scope.current!==captured||AppState.currentState!=='active'
   ||(Platform.OS==='web'&&typeof document!=='undefined'&&document.hidden))return;
  router.push(userProfileHref(playerId));
 };
 if(category!=='workout'&&category!=='service')return null;
 return <View style={styles.section}>
  <Text accessibilityRole="header" style={styles.heading}>{category==='workout'?'Try an athlete’s workout':'Serve with your community'}</Text>
  <Text style={styles.hint}>Watch on the athlete’s profile, learn their story and support them if you choose. Up to 24 current clips.</Text>
  {model.reading?<Text style={styles.hint}>Loading athlete clips…</Text>:null}
  {model.error?<Text selectable accessibilityRole="alert" style={styles.error}>{model.error}</Text>:null}
  {model.canRead?<BeyondButton label="Refresh athlete clips" disabled={model.reading||model.busy} onPress={()=>void model.refresh()}/>:null}
  {model.ready&&!model.data?.length?<Text style={styles.hint}>No athlete clips in this page.</Text>:null}
  {model.data?.map(post=><View key={`${model.identityKey}:${post.id}`} style={styles.card}>
   <Text style={styles.heading}>{post.title}</Text><Text style={styles.body}>{post.athleteName}</Text>
   <BeyondButton variant="primary" label={`View ${post.athleteName}’s athlete profile`} onPress={()=>openProfile(post.playerId)}/>
   {category==='workout'?<ChallengeBar reelId={post.id} active={active&&model.ready}/>:null}
  </View>)}
 </View>;
}
