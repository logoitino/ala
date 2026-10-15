/**
 * Trivia player preview (2026-10-15): how a question looks to a player before it is saved or approved. True or false
 * shows two big side-by-side answers; four choices stack. The correct answer is marked in words ("Correct answer"),
 * never by colour alone. It is a picture of the round, not a playable control, so nothing here can answer or score.
 * @sideEffects None.
 */
import {StyleSheet,Text,View} from 'react-native';
import {colors,radii} from '@/constants/theme';

export type SportQuizPreviewProps={topic:string;prompt:string;type:'true_false'|'choice4'|'image_choice';options:string[];correct:number|null;explanation?:string};

/** @purpose Render the question, its answers and (optionally) the explanation the player reads after answering. */
export function SportQuizPreview({topic,prompt,type,options,correct,explanation}:SportQuizPreviewProps){
  const pair=type==='true_false';
  return <View style={styles.card} accessibilityLabel="Player preview">
    <Text accessibilityRole="header" style={styles.kicker}>{`Player preview · ${topic}`}</Text>
    <Text style={styles.prompt}>{prompt.trim()||'Your question appears here.'}</Text>
    <View style={[styles.answers,pair&&styles.pair]}>
      {options.map((option,i)=>{const right=correct===i;const label=option.trim()||`Answer ${i+1}`;
        return <View key={i} accessible accessibilityLabel={`Answer ${label}${right?', correct answer':''}`} style={[styles.answer,pair&&styles.big,right&&styles.right]}>
          <Text style={[styles.answerText,pair&&styles.bigText]}>{label}</Text>
          {right?<Text style={styles.mark}>✓ Correct answer</Text>:null}
        </View>;})}
    </View>
    {explanation!==undefined?<Text style={styles.explain}>{`After answering: ${explanation.trim()||'Your explanation appears here.'}`}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({
  card:{gap:10,padding:16,borderRadius:radii.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,marginVertical:8},
  kicker:{fontSize:13,fontWeight:'700',color:colors.textMuted},
  prompt:{fontSize:20,fontWeight:'700',color:colors.text},
  answers:{gap:8},
  pair:{flexDirection:'row',flexWrap:'wrap'},
  answer:{minHeight:48,paddingHorizontal:14,paddingVertical:10,borderRadius:radii.md,borderWidth:1,borderColor:colors.border,justifyContent:'center',gap:2},
  big:{flexGrow:1,flexBasis:140,minHeight:72,alignItems:'center'},
  right:{borderWidth:3,borderColor:colors.text},
  answerText:{fontSize:16,color:colors.text},
  bigText:{fontSize:22,fontWeight:'700'},
  mark:{fontSize:13,fontWeight:'700',color:colors.text},
  explain:{fontSize:15,color:colors.text},
});
