-- Life Playbook bank (QUIZ-04, owner simplification 2026-10-15): 40 DRAFT questions (10 money_huddle, 10 savings_season, 10 scam_defense, 10 smart_plays).
-- Generated from supabase/content/life_playbook_bank.json by `node scripts/life-bank-sql.mjs`; regenerate rather than edit by hand.
-- Simple everyday facts, all 13+, no money figures or years. Every row is a draft: one admin checks the fact and
-- approves it in the admin desk like sports trivia (the server runs the Life copy rules). A chapter opens at 5 approved
-- items, so this file opens nothing: all four chapters stay closed after it loads.
-- Needs: 20261014180000_life_playbook.sql (topic_category life, chapter, min_age_band, education_only).
-- Safe to re-run: each insert skips an existing question_key. Applied: written 2026-10-15, not applied anywhere.
-- Rollback: delete from public.sport_quiz_questions where topic_category = 'life' and status = 'draft' and reason like 'Life Playbook draft (QUIZ-04)%'.

insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'c1b4c007-d311-497f-899e-dedbeb0a02fe',1,'Money Huddle',
  'A budget is a game plan for money: it shows what comes in and where it goes.',
  '["True","False"]'::jsonb,0,
  'True! A budget is like a playbook for money. It helps plan spending and saving before the money is gone.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'c1b4c007-d311-497f-899e-dedbeb0a02fe');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '2606ad8d-fc5d-43e7-bd4b-f4b780894ff5',1,'Money Huddle',
  'Food and a safe place to live are needs, not wants.',
  '["True","False"]'::jsonb,0,
  'True! Needs keep people safe and cared for. Wants are fun extras, like the newest video game.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '2606ad8d-fc5d-43e7-bd4b-f4b780894ff5');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'de61b5cb-f506-4177-a0b5-fe1e75e38504',1,'Money Huddle',
  'A budget is only useful for people with lots of money.',
  '["True","False"]'::jsonb,1,
  'False. A budget helps with any amount. Even a small allowance goes further with a plan.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'de61b5cb-f506-4177-a0b5-fe1e75e38504');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'fbaa34ed-5d0d-4454-8cbf-770bce7935fe',1,'Money Huddle',
  'Comparing prices at a few stores before buying can help get a better deal.',
  '["True","False"]'::jsonb,0,
  'True! Scouting prices is like scouting the other team. The same item can cost more in some places than others.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'fbaa34ed-5d0d-4454-8cbf-770bce7935fe');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '39ece432-dfca-4fe7-88d2-6f7fe2ea1889',1,'Money Huddle',
  'A want is something a person cannot live without.',
  '["True","False"]'::jsonb,1,
  'False. That describes a need. A want is nice to have, like a new jersey, but life goes on without it.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '39ece432-dfca-4fe7-88d2-6f7fe2ea1889');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '9a04c9a5-c04a-4fe2-8bef-5bd3c2e55630',1,'Money Huddle',
  'Which of these is a WANT?',
  '["Groceries","A warm coat in winter","A limited-edition team jersey","Water at home"]'::jsonb,2,
  'A limited-edition jersey is fun, but nobody has to have it. Food, warm clothes and water are needs.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '9a04c9a5-c04a-4fe2-8bef-5bd3c2e55630');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '90547488-1fa6-4b1f-b413-9f610ebc435b',1,'Money Huddle',
  'Coaches call the play before the snap. Before spending, a smart move is to...',
  '["Check the budget first","Spend it all right away","Buy whatever is on display","Skip looking at the price"]'::jsonb,0,
  'Checking the budget first is calling the play before the snap. It keeps spending in line with the plan.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '90547488-1fa6-4b1f-b413-9f610ebc435b');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '3fafdd47-d914-4ccd-9940-38b4778e8e8e',1,'Money Huddle',
  'Backpacks at different stores look almost the same. What helps pick the better deal?',
  '["The brightest color","Comparing price and quality","The biggest logo","Whichever is closest"]'::jsonb,1,
  'Comparing price and quality shows which backpack gives more for the money. Color and logos do not tell the whole story.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '3fafdd47-d914-4ccd-9940-38b4778e8e8e');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '9b532443-97ff-4760-9c77-efb013b9d1fb',1,'Money Huddle',
  'An impulse buy is...',
  '["A purchase planned for weeks","Money kept for later","A buy made on the spot without a plan","A bill paid on time"]'::jsonb,2,
  'An impulse buy happens in the moment, often because something looks fun. A quick pause helps check if it fits the plan.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '9b532443-97ff-4760-9c77-efb013b9d1fb');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'd39ca658-e8c6-4a1b-b6d9-e3e2308685ae',1,'Money Huddle',
  'Waiting a day before buying something unplanned is like calling a timeout. What can it help with?',
  '["Deciding if it is really wanted","Making the price go up","Losing the receipt","Forgetting the budget"]'::jsonb,0,
  'A timeout gives time to think. After a day, it is easier to tell if something is really wanted or just exciting in the moment.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','money_huddle','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'd39ca658-e8c6-4a1b-b6d9-e3e2308685ae');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '4ae74e2f-3950-42fa-bc5b-9f890251b304',1,'Savings Season',
  'Saving a little at a time can add up to something bigger later.',
  '["True","False"]'::jsonb,0,
  'True! Small amounts saved regularly add up, like small gains in practice that build over a season.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '4ae74e2f-3950-42fa-bc5b-9f890251b304');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'b0159a0a-0ddf-4f6d-b210-134e3ccc7112',1,'Savings Season',
  'A savings account is a place to keep money set aside for later.',
  '["True","False"]'::jsonb,0,
  'True! A savings account holds money for goals and surprises. A checking account is the everyday spending account.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'b0159a0a-0ddf-4f6d-b210-134e3ccc7112');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'e3de252d-fa57-4d8f-9ed8-ccf2fe753025',1,'Savings Season',
  'When a bank pays interest on savings, the money in the account can grow.',
  '["True","False"]'::jsonb,0,
  'True! Interest is extra money a bank pays for keeping savings there, so the balance grows over time.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'e3de252d-fa57-4d8f-9ed8-ccf2fe753025');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '379c4a36-1829-49df-970c-75aba4cf37cc',1,'Savings Season',
  'It is fine to share a card PIN with a friend who promises to keep it secret.',
  '["True","False"]'::jsonb,1,
  'False. A PIN is like a locker combination: it only works if it stays private. If a card is lost, tell a trusted adult right away.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '379c4a36-1829-49df-970c-75aba4cf37cc');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '4f2b92a9-2cb9-46b1-9088-a47f1e3bdde1',1,'Savings Season',
  'Saving for a goal means the money can never be spent.',
  '["True","False"]'::jsonb,1,
  'False. Saving means setting money aside for later, like new cleats. When the goal is reached, the money can go toward it.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '4f2b92a9-2cb9-46b1-9088-a47f1e3bdde1');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '514c8e3f-e2ef-4425-b5cb-61be1c8f4b05',1,'Savings Season',
  'A checking account is mostly used for...',
  '["Hiding money from everyone","Everyday spending and paying bills","Winning trophies","Keeping score in games"]'::jsonb,1,
  'A checking account is the everyday account for spending and paying bills. Savings accounts are for money set aside.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '514c8e3f-e2ef-4425-b5cb-61be1c8f4b05');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'e3b5ae33-0319-4dae-8fef-a2819347eada',1,'Savings Season',
  'Why do people save money?',
  '["Because spending is not allowed","To make prices go down","To be ready for goals and surprises","To win a trophy"]'::jsonb,2,
  'Saving gets people ready for goals, like new gear, and for surprises, like a broken phone.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'e3b5ae33-0319-4dae-8fef-a2819347eada');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'be440b46-ae9c-4d54-b63a-a1ca7080af30',1,'Savings Season',
  'Interest on savings is...',
  '["A fee for opening a door","A type of sports drink","A store coupon","Extra money a bank pays for keeping savings there"]'::jsonb,3,
  'Interest is what a bank pays for keeping savings with it. It is a simple way savings can grow.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'be440b46-ae9c-4d54-b63a-a1ca7080af30');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '0cbc1e66-2c12-49bd-a241-8dbe6043cb48',1,'Savings Season',
  'A bank card goes missing. What is a smart first play?',
  '["Tell a trusted adult and the bank right away","Wait a few months","Post the card number online","Do nothing"]'::jsonb,0,
  'Acting fast protects the account. A trusted adult can help contact the bank so the card can be stopped.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '0cbc1e66-2c12-49bd-a241-8dbe6043cb48');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '488935b0-3586-4f73-981e-f9169cd821f7',1,'Savings Season',
  'Saving for a big goal is like training for a season. What helps most?',
  '["Saving only once","Setting aside a little regularly","Spending first and never saving","Guessing"]'::jsonb,1,
  'Regular saving is like regular practice. Small, steady steps add up to big results.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','savings_season','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '488935b0-3586-4f73-981e-f9169cd821f7');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'a87f06d6-47ea-4ebc-93ec-3ac283a4c3e9',1,'Scam Defense',
  'If an offer sounds too good to be true, it is often a scam.',
  '["True","False"]'::jsonb,0,
  'True! Big promises for little effort are a classic scam play. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'a87f06d6-47ea-4ebc-93ec-3ac283a4c3e9');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'acbc2032-6224-41f6-875e-e2d408221816',1,'Scam Defense',
  'Sharing a password with someone who messages first is a safe move.',
  '["True","False"]'::jsonb,1,
  'False. Passwords stay private, even if the message looks friendly or official. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'acbc2032-6224-41f6-875e-e2d408221816');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'f8078a79-534c-41bc-a665-0adcdef7cbe5',1,'Scam Defense',
  'It is okay to send money to someone online who contacts you first and pressures you to hurry.',
  '["True","False"]'::jsonb,1,
  'False. Never send money to someone who contacts you first or pressures you. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'f8078a79-534c-41bc-a665-0adcdef7cbe5');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'a3987147-aef9-40f2-980f-2553ff868019',1,'Scam Defense',
  'Using a different strong password for each account helps protect accounts.',
  '["True","False"]'::jsonb,0,
  'True! If a password leaks, the other accounts stay safe. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'a3987147-aef9-40f2-980f-2553ff868019');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '10b25d31-3c92-4130-b7dd-db3c9df2a751',1,'Scam Defense',
  'A message that says "Act now or lose your account!" is a red flag.',
  '["True","False"]'::jsonb,0,
  'True! Scammers use panic to rush people. Real companies give time to check. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '10b25d31-3c92-4130-b7dd-db3c9df2a751');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'dd5eb954-373d-41dd-be59-8f48ab5a3c96',1,'Scam Defense',
  'Phishing is when a scammer...',
  '["Goes fishing at the lake","Pretends to be someone trusted to steal information","Sends a real thank-you card","Fixes a phone for free"]'::jsonb,1,
  'Phishing messages pretend to come from a bank, school or friend to steal passwords or personal info. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'dd5eb954-373d-41dd-be59-8f48ab5a3c96');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '00bc1452-5b1d-450a-9b16-cd7a04a52757',1,'Scam Defense',
  'A text says a prize is waiting if you click a link and type in your password. Best defense?',
  '["Click fast","Reply with the password","Forward it to friends","Do not click; delete it"]'::jsonb,3,
  'Surprise prizes and password requests are scam tricks. Not clicking keeps the defense strong. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '00bc1452-5b1d-450a-9b16-cd7a04a52757');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'c13e6eb8-4324-49af-9391-ca7cf44f776f',1,'Scam Defense',
  'Which of these is personal information to keep private?',
  '["A favorite team","Passwords and a home address","The color of a jersey","Last week''s score"]'::jsonb,1,
  'Passwords and a home address can be used to cause harm. Team colors and scores are fine to share. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'c13e6eb8-4324-49af-9391-ca7cf44f776f');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'd4b45f26-55eb-4b04-b9fb-45a9b1dad67b',1,'Scam Defense',
  'Someone a player never met messages first and asks for money to unlock a prize. What is this?',
  '["A normal prize","A team bake sale","A savings plan","A scam"]'::jsonb,3,
  'This is a scam. Never send money to someone who contacts you first or pressures you. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'd4b45f26-55eb-4b04-b9fb-45a9b1dad67b');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'f3154360-f8f6-46b7-b327-67544e048874',1,'Scam Defense',
  'Scammers often try to rush people. What beats the rush?',
  '["Pausing to check first","Answering right away","Sharing more details","Sending money fast"]'::jsonb,0,
  'Slowing down and checking breaks the scammer''s game plan. Tell a trusted adult and use Report.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','scam_defense','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'f3154360-f8f6-46b7-b327-67544e048874');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '1dec3cc5-c837-4223-ba92-88dceddd45ba',1,'Smart Plays',
  'Reading something all the way through before signing it is a smart play.',
  '["True","False"]'::jsonb,0,
  'True! Signing means agreeing. Reading first, and asking a trusted adult about anything unclear, avoids surprises.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '1dec3cc5-c837-4223-ba92-88dceddd45ba');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '4bfb5c98-d2f4-4810-b219-9f7526ecd99e',1,'Smart Plays',
  'Asking questions when something is confusing is a sign of weakness.',
  '["True","False"]'::jsonb,1,
  'False. Great players ask their coaches questions. Asking is how people learn and avoid mistakes.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '4bfb5c98-d2f4-4810-b219-9f7526ecd99e');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '11f065fe-3849-4c01-bb9f-d2dba544cdbe',1,'Smart Plays',
  'Sleeping on a big decision can help a person think it through with a clear head.',
  '["True","False"]'::jsonb,0,
  'True! Waiting until the next day takes the pressure off and makes it easier to see the whole field.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '11f065fe-3849-4c01-bb9f-d2dba544cdbe');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '306ffe51-cedd-41a1-bc45-49d090c29014',1,'Smart Plays',
  'Planning ahead is like studying the playbook before game day.',
  '["True","False"]'::jsonb,0,
  'True! Knowing the plan before the moment comes makes it easier to make good choices under pressure.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '306ffe51-cedd-41a1-bc45-49d090c29014');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'd299bfb0-8d65-49dc-8a5a-651be8f9e7bf',1,'Smart Plays',
  'If a deal says "today only," it is always smart to decide right away.',
  '["True","False"]'::jsonb,1,
  'False. Pressure to rush is a reason to slow down. Good choices usually leave time to think and ask questions.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','true_false','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'd299bfb0-8d65-49dc-8a5a-651be8f9e7bf');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '23a71977-4acb-4ec8-8140-7c60b4b96574',1,'Smart Plays',
  'Before a big decision, which move helps most?',
  '["Guessing quickly","Gathering facts and asking questions","Doing what a pop-up ad says","Ignoring the details"]'::jsonb,1,
  'Gathering facts and asking questions is like watching game film before the big game. It leads to better calls.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '23a71977-4acb-4ec8-8140-7c60b4b96574');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '65b33ed7-b1da-4540-afb2-d8e110073e79',1,'Smart Plays',
  'Someone asks a player to sign a form they do not understand. What is the smart play?',
  '["Sign it fast","Sign without reading","Ask questions and read it with a trusted adult","Hide it"]'::jsonb,2,
  'A trusted adult can help explain the form. Nobody has to sign something they do not understand.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '65b33ed7-b1da-4540-afb2-d8e110073e79');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select 'e1dd915b-7dd6-4eb4-bfa5-0652de1137e6',1,'Smart Plays',
  'A coach makes a game plan before the season. In everyday life, planning ahead helps...',
  '["Avoid last-minute surprises","Make every day the same","Skip all choices","Lose track of time"]'::jsonb,0,
  'Planning ahead means fewer surprises, like packing gear the night before a game.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = 'e1dd915b-7dd6-4eb4-bfa5-0652de1137e6');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '51eaed61-07a7-45a8-b7e0-fe2681e47352',1,'Smart Plays',
  'What does it mean to "sleep on it"?',
  '["Take a nap during class","Never decide","Wait until the next day to decide something big","Decide while very sleepy"]'::jsonb,2,
  'To sleep on it means waiting until the next day before making a big choice, so it can be made with a fresh mind.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '51eaed61-07a7-45a8-b7e0-fe2681e47352');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
select '2bb3208a-795a-4275-9257-2ba10750adab',1,'Smart Plays',
  'Which is the best example of thinking before acting?',
  '["Buying the first thing seen","Agreeing without reading","Rushing because a timer says so","Comparing choices before picking"]'::jsonb,3,
  'Comparing choices before picking is thinking before acting. It is how good players and smart shoppers make their moves.',
  'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.','life',
  'Everyday fact; no expert check needed.','choice4','smart_plays','13',true
where not exists(select 1 from public.sport_quiz_questions where question_key = '2bb3208a-795a-4275-9257-2ba10750adab');
