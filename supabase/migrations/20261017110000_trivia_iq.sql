-- IQ questions in the weekly trivia mix.
-- A personal sport round draws one unseen IQ question (topic general, sport IQ) once per round,
-- then continues with sport questions. Written, not applied.
-- Rollback: delete from public.sport_quiz_questions where sport = 'IQ' and topic_category = 'general';
-- then restore quiz_round_pick from 20261015210000_trivia_fresh_questions.sql.

create or replace function public.quiz_round_pick(p_me uuid,p_attempt uuid,p_position integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; qid uuid; hard_full boolean;
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt;
  hard_full := public.quiz_round_hard_count(a.id) >= 2;
  if a.round_kind = 'life' then
    select q.id into qid from public.sport_quiz_questions q where q.id in (select x.id from public.quiz_life_pool(p_me,a.sport_filter) x)
      and (not hard_full or not public.quiz_question_hard(q.id)) order by random() limit 1 for share of q;
    return qid;
  end if;
  if a.group_id is not null then
    select q.id into qid from public.sport_quiz_group_sets gs join public.sport_quiz_questions q on q.id = gs.question_id
      where gs.group_id = a.group_id and gs.week_start = a.week_start and gs.position = p_position
        and q.status = 'approved' and q.question_type <> 'image_choice' and public.quiz_normalize_options(q.options) is not null
        and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)
        and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = gs.question_key)
      for share of q;
    if qid is not null then return qid; end if;
    select q.id into qid from public.sport_quiz_questions q
      where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = 'sport' and (a.sport_filter is null or q.sport = a.sport_filter)
        and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)
        and (not hard_full or not public.quiz_question_hard(q.id))
        and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
      order by exists(select 1 from public.sport_quiz_group_sets gs where gs.group_id = a.group_id and gs.week_start = a.week_start
                        and gs.position > p_position and gs.question_key = q.question_key), random()
      limit 1 for share of q;
    return qid;
  end if;
  if p_position = public.quiz_fact_slot(p_me,a.id) then
    qid := public.quiz_fact_pick(p_me,a.id);
    if qid is not null then return qid; end if;
  end if;
  -- One IQ question in a personal sport round, before the ordinary sport draw.
  if a.topic_category = 'sport' and not exists (
      select 1 from public.sport_quiz_round_items i
      join public.sport_quiz_questions asked on asked.id = i.question_id
      where i.attempt_id = a.id and asked.sport = 'IQ') then
    select q.id into qid from public.sport_quiz_questions q
      where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = 'general' and q.sport = 'IQ'
        and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)
        and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
      order by random() limit 1 for share of q;
    if qid is not null then return qid; end if;
  end if;
  select q.id into qid from public.sport_quiz_questions q
    where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = a.topic_category and a.topic_category not in ('life','athlete')
      and (a.sport_filter is null or q.sport = a.sport_filter)
      and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)
      and (not hard_full or not public.quiz_question_hard(q.id))
      and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
    order by random() limit 1 for share of q;
  return qid;
end $$;

insert into public.sport_quiz_questions
  (question_key, version, sport, prompt, options, correct_option, explanation, status, reason, topic_category, source_notes, question_type)
select v.key, 1, 'IQ', v.prompt, v.options::jsonb, v.correct_option, v.explanation, 'approved',
  'Simple reasoning item for the weekly trivia mix.', 'general',
  'Public reasoning item. Not a school score or a medical claim.', 'choice4'
from (values
  ('a1b2c3d4-e5f6-4789-a012-000000000001'::uuid, 'What number comes next: 2, 4, 8, 16?', '["32","18","24","12"]', 0, 'Each number is double the one before it, so 16 doubles to 32.'),
  ('a1b2c3d4-e5f6-4789-a012-000000000002'::uuid, 'Which word does not belong with the others?', '["Carrot","Apple","Banana","Grape"]', 0, 'Apple, banana and grape are fruits. A carrot is a vegetable.'),
  ('a1b2c3d4-e5f6-4789-a012-000000000003'::uuid, 'If every bloops is a razzle, and every razzle is a lazzle, is every bloops a lazzle?', '["Yes","No","Only some","Cannot tell"]', 0, 'If every bloops is a razzle and every razzle is a lazzle, then every bloops is a lazzle.'),
  ('a1b2c3d4-e5f6-4789-a012-000000000004'::uuid, 'A cap and a shirt together cost 30 dollars. The shirt costs 20 dollars more than the cap. What does the cap cost?', '["5 dollars","10 dollars","15 dollars","20 dollars"]', 0, 'The cap is 5 dollars and the shirt is 25 dollars. Together they are 30, and the shirt is 20 more.'),
  ('a1b2c3d4-e5f6-4789-a012-000000000005'::uuid, 'Which shape has exactly three sides?', '["Triangle","Square","Circle","Hexagon"]', 0, 'A triangle has three sides. A square has four, a hexagon has six, and a circle has none.'),
  ('a1b2c3d4-e5f6-4789-a012-000000000006'::uuid, 'What letter comes next: A, C, E, G?', '["I","H","J","F"]', 0, 'The letters skip one each time: A, C, E, G, then I.')
) as v(key, prompt, options, correct_option, explanation)
where not exists (select 1 from public.sport_quiz_questions q where q.question_key = v.key);
