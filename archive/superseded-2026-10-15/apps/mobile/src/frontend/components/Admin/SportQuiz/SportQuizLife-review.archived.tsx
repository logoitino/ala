// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from apps/mobile/src/frontend/components/Admin/SportQuiz/SportQuizLife.tsx (SportQuizLife CPA sign-off panel, SportQuizLife reviewer grants panel, SportQuizLife re-review list panel).
// Not built, tested or imported. Restore: paste the panels back into SportQuizLife after the archived sign-off / reviewer RPCs and lib wrappers return, with the onSignoff / onConfirmSignoff / onGrant / onConfirmGrant / onRevoke props.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/* Draft state and validation the removed panels used. */
  const [signoff,setSignoff]=useState({chapter:'credit_clock' as LifeChapterId,name:'',on:'',note:''});
  const [grantForm,setGrantForm]=useState({profile:'',domain:'finance' as LifeDomain,qualification:'',expires:''});
  const yearAgo=`${Number(data.today.slice(0,4))-1}${data.today.slice(4)}`;
  const signoffOk=Array.from(signoff.name.trim()).length>=3&&day.test(signoff.on)&&signoff.on<=data.today&&signoff.on>=yearAgo&&signoff.note.length<=500;
  const grantOk=uuid.test(grantForm.profile.trim())&&Array.from(grantForm.qualification.trim()).length>=3&&(grantForm.expires===''||day.test(grantForm.expires));

/* Removed panels (CPA sign-off, finance / tax reviewers, re-review list). */
    <AdminPanel title="CPA sign-off">
      <Text>Record a CPA's sign-off from the signed document (dated within the last 12 months). A second admin who wrote no question in that chapter must confirm it. It covers the questions approved when it is recorded; later approvals need a new sign-off. Tax sign-offs end at the January withdrawal; Credit Clock after 12 months.</Text>
      <AdminPills label="Chapter" value={signoff.chapter} items={data.chapters.filter(c=>c.needs_signoff).map(c=>({id:c.id,label:c.title}))} onChange={chapter=>setSignoff(old=>({...old,chapter}))}/>
      <AdminField label="Signed by (name and credential)" value={signoff.name} onChangeText={name=>setSignoff(old=>({...old,name}))}/>
      <AdminField label="Signed on (YYYY-MM-DD)" value={signoff.on} onChangeText={on=>setSignoff(old=>({...old,on}))}/>
      <AdminField label="Note (optional)" value={signoff.note} multiline onChangeText={note=>setSignoff(old=>({...old,note}))}/>
      <AdminBtn label="Record CPA sign-off" disabled={!!busy||!hasReason||!signoffOk} onPress={()=>onSignoff({chapter:signoff.chapter,signed_by_name:signoff.name.trim(),signed_on:signoff.on,note:signoff.note.trim()||null})}/>
      {data.signoffs.map(x=><AdminPanel key={x.id} title={`${x.chapter} · ${x.signed_by_name} · ${x.current?'current':x.confirmed_at?'expired':'waiting for a second admin'}`}>
        <Text>{`Signed ${x.signed_on} · covers ${x.covers_count} questions · expires ${x.expires_on} · recorded ${x.recorded_at}${x.confirmed_at?` · confirmed ${x.confirmed_at}`:''}${x.note?` · ${x.note}`:''}`}</Text>
        {!x.confirmed_at?<AdminBtn label={`Confirm sign-off ${x.id} (second admin)`} disabled={!!busy||!hasReason} onPress={()=>onConfirmSignoff(x.id)}/>:null}
      </AdminPanel>)}
    </AdminPanel>
    <AdminPanel title="Finance and tax reviewers">
      <Text>Only a named reviewer for the item's domain approves a Life question, and never one who wrote a version since the last approval. Grants go to another adult admin; you cannot grant yourself, and a second admin (not you, not the reviewer) must confirm before the grant counts. The owner normally grants; on hosted, admins do it with audited reasons.</Text>
      <AdminField label="Reviewer profile ID" value={grantForm.profile} onChangeText={profile=>setGrantForm(old=>({...old,profile}))}/>
      <AdminPills label="Domain" value={grantForm.domain} items={[{id:'finance',label:'Finance'},{id:'tax',label:'Tax'}]} onChange={domain=>setGrantForm(old=>({...old,domain}))}/>
      <AdminField label="Qualification" value={grantForm.qualification} onChangeText={qualification=>setGrantForm(old=>({...old,qualification}))}/>
      <AdminField label="Expires on (optional, YYYY-MM-DD)" value={grantForm.expires} onChangeText={expires=>setGrantForm(old=>({...old,expires}))}/>
      <AdminBtn label="Grant reviewer" disabled={!!busy||!hasReason||!grantOk} onPress={()=>onGrant({profile_id:grantForm.profile.trim(),domain:grantForm.domain,qualification:grantForm.qualification.trim(),
        expires_at:grantForm.expires?`${grantForm.expires}T23:59:59Z`:null})}/>
      {data.reviewers.length?data.reviewers.map(g=><AdminPanel key={g.id} title={`${g.display_name} · ${g.domain} · ${g.active?'active':g.revoked_at?'revoked':!g.confirmed_at?'waiting for a second admin':'expired'}`}>
        <Text>{`${g.qualification} · granted ${g.granted_at}${g.expires_at?` · expires ${g.expires_at}`:''} · ${g.grant_reason}`}</Text>
        {g.revoked_at?<Text>{`Revoked ${g.revoked_at}: ${g.revoke_reason??''}`}</Text>:null}
        {!g.confirmed_at&&!g.revoked_at?<AdminBtn label={`Confirm ${g.display_name} (${g.domain}) as second admin`} disabled={!!busy||!hasReason} onPress={()=>onConfirmGrant(g.id)}/>:null}
        {!g.revoked_at?<AdminBtn label={`Revoke ${g.display_name} (${g.domain})`} kind="danger" disabled={!!busy||!hasReason} onPress={()=>onRevoke(g.id)}/>:null}
      </AdminPanel>):<Text>No reviewers granted. Life questions cannot be approved yet.</Text>}
    </AdminPanel>
    <AdminPanel title="Re-review list">
      <Text>Approved Life questions due within 30 days or overdue (tax every January, others yearly), and any withdrawn after 31 January because their tax year has passed. Re-review from the question bank.</Text>
      {data.rereview.length?data.rereview.map(q=><Text key={q.id}>{`${q.chapter} · version ${q.version} · ${q.withdrawn?'withdrawn (tax year passed)':q.overdue?'overdue':'due'} ${q.review_due_on??''} · ${q.prompt}`}</Text>)
        :<Text>Nothing due.</Text>}
    </AdminPanel>
