// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from apps/mobile/src/frontend/components/Admin/SportQuiz/SportQuizBank.tsx (SportQuizBank re-review and reviewer display).
// Not built, tested or imported. Restore: paste back into SportQuizBank with the archived 'rereview' action, reviewer columns and SQL.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

        {selectedLife&&selected?.status==='draft'?<Text>{lifeIssue??'Approval needs your active finance or tax reviewer grant for this chapter, and you must not have written any version since the last approval. The server also runs the Life copy rules.'}</Text>:null}
        {selectedLife&&selected?.status==='approved'?<>
          <Text>{`Review due ${selected.review_due_on??'not set'}${selected.as_of_tax_year?` · tax year ${selected.as_of_tax_year}`:''} · reviewer ${selected.life_reviewer_id??'unknown'}.`}</Text>
          <AdminBtn label="Record yearly re-review (domain reviewer)" disabled={!!busy||!hasReason} onPress={()=>write('rereview')}/>
        </>:null}
      {q.topic_category==='life'?<Text>{`Life · ${q.chapter} · ${q.min_age_band}+ · ${q.domain} · attested ${q.education_only?'yes':'no'} · source ${q.source_url??'missing'} retrieved ${q.source_retrieved_on??'not recorded'}${q.as_of_tax_year?` · tax year ${q.as_of_tax_year}`:''} · reviewer ${q.life_reviewer_id??'none'} · review due ${q.review_due_on??'not set'}`}</Text>:null}
