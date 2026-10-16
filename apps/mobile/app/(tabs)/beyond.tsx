/** Beyond the Game page: fan workouts, service, learning and stories plus own posts. Opened from the Highlights
 * Beyond switch or Upload ＋ (`?compose=1` opens the composer); no longer a bar tab (owner 2026-10-16). Discovery
 * pause is separate from the reviewed-contribution switch. */
import {useCallback,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import type {BeyondCategory} from '@tapuai/shared-types/beyondGame';
import {TabScreen} from '@/components/TabScreen';
import {RuntimePaused} from '@/components/RuntimePaused';
import {AnimatedButton} from '@/components/UI/AnimatedButton';
import {BeyondGameScreen} from '@/components/BeyondGame/BeyondGameScreen';
import {LegacyWorkoutList} from '@/components/BeyondGame/LegacyWorkoutList';
import {useAppRuntime} from '@/context/AppRuntimeContext';
import {colors} from '@/constants/theme';
export default function BeyondTab() {
 const {live}=useAppRuntime();const [focused,setFocused]=useState(false);
 const {compose}=useLocalSearchParams<{compose?:string}>();
 useFocusEffect(useCallback(()=>{setFocused(true);return()=>setFocused(false);},[]));
 const legacy=useCallback((category:BeyondCategory)=><LegacyWorkoutList category={category} active={focused&&live.tabs.beyond}/>,[focused,live.tabs.beyond]);
 const composeStarted=useCallback(()=>router.setParams({compose:undefined}),[]);
 const back=()=>{if(router.canGoBack())router.back();else router.replace('/');};
 return <TabScreen>
  <View style={styles.bar}>
   <AnimatedButton haptic="selection" accessibilityRole="button" accessibilityLabel="Back to Highlights" contentStyle={styles.back} onPress={back}>
    <Ionicons name="chevron-back" size={18} color={colors.text}/><Text style={styles.backLabel}>Highlights</Text>
   </AnimatedButton>
  </View>
  {live.tabs.beyond?<BeyondGameScreen active={focused} renderLegacy={legacy} startComposing={compose==='1'} onComposeStarted={composeStarted}/>:<RuntimePaused title="Beyond the Game is paused" lede="Enable Beyond in Features and publish."/>}
 </TabScreen>;
}
const styles=StyleSheet.create({
 bar:{paddingHorizontal:12,paddingTop:4},
 back:{alignSelf:'flex-start',minHeight:44,paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:2},
 backLabel:{color:colors.text,fontSize:15,fontWeight:'700'},
});
