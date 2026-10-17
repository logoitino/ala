-- Student-athlete life lessons (2026-10-16): 15 DRAFT general questions.
-- American history, the job site (electrician and construction), and practice fuel.
-- Generated from supabase/content/trivia_starter_bank.json. Status stays draft until Content approves each one.
-- Facts are general education. Health items are not a meal plan, a training plan, or medical advice.
-- Needs: 20261014160000_trivia_play_together.sql. Safe to re-run. Applied: written 2026-10-16, not applied anywhere.
-- Rollback: delete from public.sport_quiz_questions where question_key in (
--   '4689e3e1-3578-4378-8d0f-d8baa231dab4','034cdd81-4ab9-4e83-8252-b121370b61dd','cb7e6234-c998-402b-bc10-05ebc04cfac5',
--   '8ec72261-cb35-4ff0-8333-c078dc0a2f1c','d3d3c143-a66c-4f91-ac35-3abbb0cebdc2','2f915c2f-ada4-42a7-94fb-e94e418bb0e8',
--   '4e3a5a83-9ae9-4203-8e71-da8144d7be83','c6266dd9-c915-4c53-a03c-4215673d29c0','4a8c563c-7031-4502-addf-ac3f4a600efe',
--   '027d4fb6-221a-4a51-b9a2-200336a7c0a2','3545973d-52b9-4f86-80b1-ba7c945658a2','6aa7670c-bb08-45b2-b6ea-937aa5ef2ace',
--   '5a80ada6-e2cc-4a48-b290-0c670a12209b','5f9b4b3d-73d8-48d5-ac5d-a28ec042d98d','8f6bcbc7-e829-4ac5-adfa-50542d9a0425');

insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '4689e3e1-3578-4378-8d0f-d8baa231dab4',1,'General',
  'The United States government has three branches. Which list names them?',
  '["Legislative, executive, and judicial","Army, navy, and air force","Cities, states, and towns","Schools, teams, and clubs"]'::jsonb,0,
  'The three branches are legislative, executive, and judicial. They share the work of making laws, carrying them out, and judging them.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'National Archives, the Constitution at a glance; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = '4689e3e1-3578-4378-8d0f-d8baa231dab4');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '034cdd81-4ab9-4e83-8252-b121370b61dd',1,'General',
  'The Constitution is the highest law in the United States.',
  '["True","False"]'::jsonb,0,
  'True! The Constitution sits above other laws in the United States. Public officials promise to support it.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'National Archives, the Constitution; to verify.','true_false'
where not exists(select 1 from public.sport_quiz_questions where question_key = '034cdd81-4ab9-4e83-8252-b121370b61dd');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select 'cb7e6234-c998-402b-bc10-05ebc04cfac5',1,'General',
  'What is the Bill of Rights?',
  '["The first ten amendments to the Constitution","The rules of a sports league","A team''s playbook","A school attendance sheet"]'::jsonb,0,
  'The Bill of Rights is the first ten amendments to the Constitution. It lists freedoms such as speech and religion.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'National Archives, the Bill of Rights; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = 'cb7e6234-c998-402b-bc10-05ebc04cfac5');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '8ec72261-cb35-4ff0-8333-c078dc0a2f1c',1,'General',
  'Congress is the part of the United States government that writes federal laws.',
  '["True","False"]'::jsonb,0,
  'True! Congress is the legislative branch. It is made up of the House of Representatives and the Senate.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'USA.gov, branches of the U.S. government; to verify.','true_false'
where not exists(select 1 from public.sport_quiz_questions where question_key = '8ec72261-cb35-4ff0-8333-c078dc0a2f1c');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select 'd3d3c143-a66c-4f91-ac35-3abbb0cebdc2',1,'General',
  'The Declaration of Independence names life, liberty, and what else?',
  '["The pursuit of happiness","A starting spot on the team","A reserved seat","A longer practice"]'::jsonb,0,
  'The Declaration names life, liberty, and the pursuit of happiness. It states why the colonies separated.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'National Archives, the Declaration of Independence; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = 'd3d3c143-a66c-4f91-ac35-3abbb0cebdc2');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '2f915c2f-ada4-42a7-94fb-e94e418bb0e8',1,'General',
  'What does an electrician work with in a building?',
  '["Wiring and electrical systems","Only the paint on the walls","The grass on the field","The lines on a court"]'::jsonb,0,
  'An electrician installs and looks after wiring and electrical systems. That work brings light and power into a building.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'Bureau of Labor Statistics, electrician overview; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = '2f915c2f-ada4-42a7-94fb-e94e418bb0e8');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '4e3a5a83-9ae9-4203-8e71-da8144d7be83',1,'General',
  'A circuit breaker is built to stop electricity when a circuit is overloaded.',
  '["True","False"]'::jsonb,0,
  'True! A breaker opens the circuit when too much electricity flows. That protects the wiring from overheating.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'Electrical Safety Foundation International, circuit breaker basics; to verify.','true_false'
where not exists(select 1 from public.sport_quiz_questions where question_key = '4e3a5a83-9ae9-4203-8e71-da8144d7be83');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select 'c6266dd9-c915-4c53-a03c-4215673d29c0',1,'General',
  'Why do people on a construction site wear hard hats?',
  '["To protect the head from falling objects","To keep the score","To carry water","To mark the team captain"]'::jsonb,0,
  'A hard hat protects the head. Tools and materials can fall on a job site.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'OSHA construction head-protection overview; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = 'c6266dd9-c915-4c53-a03c-4215673d29c0');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '4a8c563c-7031-4502-addf-ac3f4a600efe',1,'General',
  'A wall stud is a vertical piece of the frame that helps hold the wall up.',
  '["True","False"]'::jsonb,0,
  'True! Studs stand upright inside a wall. They carry the wall and give a place to fasten the surface.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'Common construction glossary, wall framing; to verify.','true_false'
where not exists(select 1 from public.sport_quiz_questions where question_key = '4a8c563c-7031-4502-addf-ac3f4a600efe');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '027d4fb6-221a-4a51-b9a2-200336a7c0a2',1,'General',
  'Why is water kept away from live electrical work?',
  '["Water can carry electricity","Water makes wires lighter","Water cools every tool","Water is the same as air"]'::jsonb,0,
  'Water can carry electricity. A wet floor and a live wire are a dangerous pair. A licensed electrician handles live electrical work.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'Electrical Safety Foundation International, water and electricity; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = '027d4fb6-221a-4a51-b9a2-200336a7c0a2');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '3545973d-52b9-4f86-80b1-ba7c945658a2',1,'General',
  'After practice, muscles rebuild using which nutrient?',
  '["Protein","Food coloring","Sand","Chalk"]'::jsonb,0,
  'Protein is a nutrient the body uses when muscles rebuild after practice. Beans, eggs, milk, fish, and meat provide it. A parent or a doctor can help with meals.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'USDA MyPlate, protein foods; general education, not a meal plan; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = '3545973d-52b9-4f86-80b1-ba7c945658a2');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '6aa7670c-bb08-45b2-b6ea-937aa5ef2ace',1,'General',
  'Sweat during practice is mostly water leaving the body.',
  '["True","False"]'::jsonb,0,
  'True! Sweat is mostly water. Drinking water puts fluid back after a workout.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'CDC, water and hydration overview; general education, not a drinking plan; to verify.','true_false'
where not exists(select 1 from public.sport_quiz_questions where question_key = '6aa7670c-bb08-45b2-b6ea-937aa5ef2ace');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '5a80ada6-e2cc-4a48-b290-0c670a12209b',1,'General',
  'When does a tired body do a lot of its recovery from a hard practice?',
  '["During sleep","During a commercial","While holding a breath","In the first second of a sprint"]'::jsonb,0,
  'Sleep is a recovery time. Muscles and the mind get a chance to restore after practice.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'CDC, sleep and health overview for teens; general education, not a sleep prescription; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = '5a80ada6-e2cc-4a48-b290-0c670a12209b');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '5f9b4b3d-73d8-48d5-ac5d-a28ec042d98d',1,'General',
  'Fruits and vegetables provide vitamins the body uses to do its work.',
  '["True","False"]'::jsonb,0,
  'True! Vitamins from fruits and vegetables help the body carry out everyday work, including practice and class.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'USDA MyPlate, fruits and vegetables; general education, not a meal plan; to verify.','true_false'
where not exists(select 1 from public.sport_quiz_questions where question_key = '5f9b4b3d-73d8-48d5-ac5d-a28ec042d98d');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
select '8f6bcbc7-e829-4ac5-adfa-50542d9a0425',1,'General',
  'Muscles grow stronger from practice together with what else?',
  '["Rest","Skipping meals","Staying awake all night","One sprint and nothing else"]'::jsonb,0,
  'Practice asks the muscles to work. Rest lets them rebuild. The two go together. A parent or a doctor can help with a real plan.',
  'Starter draft (QUIZ-03); Content verifies the source before approval.','general',
  'American College of Sports Medicine, recovery overview; general education, not training advice; to verify.','choice4'
where not exists(select 1 from public.sport_quiz_questions where question_key = '8f6bcbc7-e829-4ac5-adfa-50542d9a0425');
