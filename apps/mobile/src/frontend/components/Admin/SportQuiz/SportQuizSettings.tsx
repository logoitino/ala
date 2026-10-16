/**
 * Trivia Settings (2026-10-15): the existing controls gathered in one panel with plain labels. Trivia state (paused or
 * on for listed testers) and the tester list; rounds and the groups switch, with images locked off; the Life Playbook
 * switch and level thresholds; QUIZ-05 adds fun facts, report intake and the self-heal thresholds. Each part saves through its own existing server write with the desk's reason; nothing
 * here is a new setting.
 * @sideEffects None directly; the desk saves through quiz_admin_settings, quiz_admin_play_settings and
 * quiz_admin_life_settings bound to its captured admin identity.
 */
import {Text,View} from 'react-native';
import {AdminBtn,AdminField,AdminPanel} from '@/components/Admin/AdminChrome';
import type {LifeAdminSnapshot,LifeLevelThresholds} from '@/lib/lifePlaybook';
import type {TimedQuizAdminSnapshot,TriviaPlaySettingsInput} from '@/lib/sportQuiz';
import {SportQuizLifeSettings} from './SportQuizLife';
import {SportQuizPlay} from './SportQuizPlay';
import {SportQuizFreshSettings} from './SportQuizFreshSettings';
import type {FreshSettingsInput,FreshStatus} from '@/lib/freshQuestions';

export type SportQuizSettingsProps={settings:TimedQuizAdminSnapshot['settings'];weekStart:string;weekEnd:string;generatedAt:string;
  testers:string;onTesters:(v:string)=>void;pilotIds:string[];validTesters:boolean;hasReason:boolean;busy:string|null;
  onConfigure:(enabled:boolean,ids:string[])=>void;play:TriviaPlaySettingsInput|null;onSavePlay:(next:TriviaPlaySettingsInput)=>void;
  life:LifeAdminSnapshot|null;lifeError:string|null;onSaveLife:(enabled:boolean,thresholds:LifeLevelThresholds)=>void;
  /** QUIZ-05: fun facts, report intake and self-heal thresholds (absent on an older server). */
  fresh?:FreshStatus|null;onSaveFresh?:(next:FreshSettingsInput)=>void};

/** @purpose One place for every trivia switch the server supports; each change needs the reason at the top of the desk. */
export function SportQuizSettings({settings,weekStart,weekEnd,generatedAt,testers,onTesters,pilotIds,validTesters,hasReason,busy,onConfigure,play,onSavePlay,life,lifeError,onSaveLife,fresh,onSaveFresh}:SportQuizSettingsProps){
  const blocked=busy||(!settings?'unavailable':null);
  return <View>
    <Text accessibilityRole="header" style={{fontSize:20,fontWeight:'800',marginTop:16}}>Settings</Text>
    <Text>Every change here records the review or correction reason at the top of the desk.</Text>
    <AdminPanel title="Trivia state and testers">
      {settings?<>
        <Text>{`${settings.enabled?'Enabled for listed testers':'Paused'} · testing only · ${settings.pilot_accounts.length}/100 tester accounts`}</Text>
        <Text>{`UTC week: ${weekStart} to ${weekEnd} (end excluded). Source read ${generatedAt}.`}</Text>
        <AdminField label="Tester profile IDs" value={testers} onChangeText={onTesters} multiline placeholder="Canonical profile UUIDs separated by commas or new lines"/>
        <Text>No Stripe, athlete or school verification requirement. The server checks accepted age and enrolled account capability.</Text>
        <Text>Invitations default off. Manual play remains optional. 30 or 90 seconds before Start; the server owns expiry. Pause permanently ends active rounds.</Text>
        <AdminBtn label="Enable for listed testers" kind="primary" disabled={!!busy||!hasReason||!validTesters||!pilotIds.length} onPress={()=>onConfigure(true,pilotIds)}/>
        <AdminBtn label="Save tester list while paused" disabled={!!busy||!hasReason||!validTesters} onPress={()=>onConfigure(false,pilotIds)}/>
        <AdminBtn label="Pause quiz" kind="danger" disabled={!!busy||!hasReason} onPress={()=>onConfigure(false,settings.pilot_accounts)}/>
      </>:<Text>Settings unavailable. No enable, pause or mutation controls are available; repair the singleton source.</Text>}
    </AdminPanel>
    <SportQuizPlay current={play} busy={blocked} hasReason={hasReason} onSave={onSavePlay}/>
    <SportQuizLifeSettings data={life} error={lifeError} busy={blocked} hasReason={hasReason} onSaveSettings={onSaveLife}/>
    {onSaveFresh?<SportQuizFreshSettings current={fresh??null} busy={blocked} hasReason={hasReason} onSave={onSaveFresh}/>:null}
  </View>;
}
