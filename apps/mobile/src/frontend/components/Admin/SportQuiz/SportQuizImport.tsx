/**
 * QUIZ-05 bulk import: paste rows from a sheet (tab-separated) or CSV, preview them with a server dry run (every rule and
 * duplicate result per row), then "Import as drafts". Nothing is approved here; there is no approve-all. The server
 * re-checks every row; this form only reads the paste into rows.
 * @sideEffects None directly; the desk calls quiz_admin_import (dry run, then real) bound to its captured admin identity.
 */
import {useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {AdminBtn,AdminField,AdminPanel} from '@/components/Admin/AdminChrome';
import {IMPORT_MAX_ROWS,IMPORT_PROBLEM_WORDS,parseImportPaste,type ImportResult,type ImportRow} from '@/lib/freshQuestions';

export type SportQuizImportProps={busy:string|null;hasReason:boolean;result:ImportResult|null;onPreview:(rows:ImportRow[])=>void;onImport:(rows:ImportRow[])=>void};
const COLUMNS='topic | sport or chapter | type | question | answer 1 | answer 2 | answer 3 | answer 4 | correct (1–4) | explanation | source';

/** @purpose Paste → preview table → import; Import is enabled only after a dry run of exactly these rows. */
export function SportQuizImport({busy,hasReason,result,onPreview,onImport}:SportQuizImportProps){
  const [paste,setPaste]=useState('');
  const [previewed,setPreviewed]=useState<string|null>(null);
  const {rows,errors}=parseImportPaste(paste);
  const key=JSON.stringify(rows);
  const ready=!!result&&result.dry_run&&previewed===key&&result.rows_ready>0;
  return <AdminPanel title="Bulk import">
    <Text>{`Paste up to ${IMPORT_MAX_ROWS} rows (64 KB) from a sheet. Columns: ${COLUMNS}. Rows land as drafts for review; fun facts and image questions cannot be imported.`}</Text>
    <AdminField label="Rows to import" value={paste} onChangeText={v=>{setPaste(v);setPreviewed(null);}} multiline placeholder="sport	Basketball	choice4	How many players …"/>
    <Text>{`${rows.length} row${rows.length===1?'':'s'} read${errors.length?`, ${errors.length} unreadable`:''}.`}</Text>
    {errors.map(e=><Text key={e.line} accessibilityRole="alert">{`Line ${e.line}: ${e.message}`}</Text>)}
    <View style={styles.buttons}>
      <AdminBtn label={busy==='import_preview'?'Checking…':'Preview (dry run)'} disabled={!!busy||!hasReason||!rows.length||rows.length>IMPORT_MAX_ROWS} onPress={()=>{setPreviewed(key);onPreview(rows);}}/>
      <AdminBtn label={busy==='import'?'Importing…':'Import as drafts'} kind="primary" disabled={!!busy||!hasReason||!ready} onPress={()=>onImport(rows)}/>
    </View>
    {result?<View accessibilityLabel="Import results">
      <Text style={styles.title}>{`${result.dry_run?'Preview':'Imported'}: ${result.rows_ready} ${result.dry_run?'ready':'drafts'} · ${result.rows_refused} refused · ${result.rows_warned} with warnings · room left: ${result.trivia_left} trivia, ${result.life_left} Life`}</Text>
      {result.rows.map(r=>{const row=rows[r.index];return <Text key={r.index} style={styles.row}>
        {`Row ${r.index+1} · ${r.status==='refused'?'Refused':r.status==='imported'?'Imported as a draft':'Ready'} · ${row?row.prompt:''}${r.problems.length?` · ${r.problems.map(p=>p.startsWith('life_copy:')?`Life word rule: ${p.slice(10)}`:IMPORT_PROBLEM_WORDS[p]??p).join('; ')}`:''}${r.warnings.length?` · Warning: ${r.warnings.map(w=>w.code==='near_duplicate'?'very close to a question already in the bank':`very close to row ${(w.row??0)+1}`).join('; ')}`:''}`}
      </Text>;})}
    </View>:null}
    {!hasReason?<Text>Enter the reason at the top of the desk first.</Text>:null}
  </AdminPanel>;
}
const styles=StyleSheet.create({buttons:{flexDirection:'row',flexWrap:'wrap',gap:8},title:{fontWeight:'700',marginTop:8},row:{fontSize:13,marginVertical:2}});
