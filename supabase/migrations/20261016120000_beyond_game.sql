-- BEYOND-01 source/admin stage. New private any-account content; never reels, athlete tags, money or messages.
-- Owner: HIGHLIGHTS / BACKEND. Reads recheck PRIV-01 and MINOR-01. Canonical copy is root-owned.
-- Limits are pilot implementation choices: 5 durable reservations/24h, 24h draft expiry, SDK-requested 60s signed access,
-- JPEG<=5MiB, video<=50MiB and attested duration<=45s. Storage metadata is not a trusted video decoder:
-- preprocessing + explicit admin preview are required; actual provider deletion/device behavior remain release evidence.

create table if not exists public.beyond_settings (
  id boolean primary key default true check(id),
  changed_at timestamptz,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text check(reason is null or char_length(reason) between 5 and 240)
);
insert into public.beyond_settings(id) values(true) on conflict do nothing;
create table if not exists public.beyond_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  category text not null check(category in ('workout','service','learning','story')),
  caption text not null check(char_length(caption) between 1 and 240),
  audience text not null check(audience in ('friends','everyone')),
  status text not null default 'draft' check(status in ('draft','pending','approved','held','removed')),
  revision integer not null default 1 check(revision>0),
  rights_version text not null check(rights_version='beyond-rights-1'),
  safety_version text not null check(safety_version='beyond-safety-1'),
  attested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_reason text check(review_reason is null or char_length(review_reason) between 5 and 240),
  removed_at timestamptz,
  cleanup text not null default 'not_requested' check(cleanup in ('not_requested','pending','partial','complete')),
  cleanup_checked_at timestamptz,
  unique(owner_id,request_id)
);
create index if not exists beyond_posts_queue on public.beyond_posts(status,id desc);
create index if not exists beyond_posts_owner on public.beyond_posts(owner_id,id desc);
create table if not exists public.beyond_media (
  id uuid primary key,
  post_id uuid not null references public.beyond_posts(id) on delete cascade,
  position integer not null check(position between 0 and 2),
  kind text not null check(kind in ('photo','video')),
  path text not null unique,
  mime text not null check(mime in ('image/jpeg','video/mp4')),
  bytes bigint not null check(bytes>0 and bytes<=52428800),
  width integer not null check(width between 1 and 4096),
  height integer not null check(height between 1 and 4096),
  duration_ms integer check(duration_ms between 1 and 45000),
  constraint beyond_media_kind check((kind='photo' and mime='image/jpeg' and bytes<=5242880 and duration_ms is null) or(kind='video' and mime='video/mp4' and position=0 and duration_ms is not null)),
  unique(post_id,position)
);
-- Separate from the post: removing a draft/post never refunds submission capacity.
create table if not exists public.beyond_submission_quota (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  reserved_at timestamptz not null default now(),
  primary key(owner_id,request_id)
);
create index if not exists beyond_quota_time on public.beyond_submission_quota(owner_id,reserved_at);
create table if not exists public.beyond_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.beyond_posts(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check(char_length(reason) between 5 and 240),
  created_at timestamptz not null default now(),
  unique(post_id,reporter_id)
);
create table if not exists public.beyond_admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.beyond_posts(id) on delete set null,
  action text not null check(action in ('on','off','approve','remove','retention','cleanup')),
  reason text not null check(char_length(reason) between 5 and 240),
  created_at timestamptz not null default now()
);

do $$declare t text;begin
 foreach t in array array['beyond_settings','beyond_posts','beyond_media','beyond_submission_quota','beyond_reports','beyond_admin_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end$$;

-- Helpers are SECURITY DEFINER with an empty search_path and revoked direct execution below.
create or replace function public.beyond_missing()
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare missing jsonb:='[]';begin
 if to_regprocedure('public.my_profile_id()') is null then missing:=missing||'"PRIV-01 profiles"'::jsonb;end if;
 if to_regprocedure('public.are_friends(uuid,uuid)') is null then missing:=missing||'"PRIV-01 friends"'::jsonb;end if;
 if to_regprocedure('public.is_blocked_between(uuid,uuid)') is null then missing:=missing||'"PRIV-01 blocks"'::jsonb;end if;
 if to_regprocedure('public.profile_item_visible(uuid,text)') is null then missing:=missing||'"PRIV-01 privacy"'::jsonb;end if;
 if to_regprocedure('public.profile_age_band(uuid)') is null then missing:=missing||'"MINOR-01 age"'::jsonb;end if;
 if to_regprocedure('public.is_supervising_guardian(uuid)') is null then missing:=missing||'"MINOR-01 guardian"'::jsonb;end if;
 return missing;end$$;
create or replace function public.beyond_enabled()
returns boolean language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
begin
 return jsonb_array_length(public.beyond_missing())=0 and exists(select 1 from public.app_runtime_config c where c.id='default' and c.published#>'{highlights,beyondGameEnabled}'='true'::jsonb);
end$$;
create or replace function public.beyond_actor(expected uuid,allow_guest boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;begin
 if auth.uid() is null then
  if allow_guest and expected is null and coalesce(auth.role(),'anon') in ('anon','') then return null;end if;
  raise exception 'Sign in to continue.';
 end if;
 if auth.role()<>'authenticated' then raise exception 'Sign in to continue.';end if;
 select p.id into me from public.profiles p where p.user_id=auth.uid() and p.age_blocked_at is null for update;
 if me is null or expected is null or me<>expected then raise exception 'Your account changed. Reopen this control.';end if;
 if public.profile_age_band(me)='under_13' then raise exception 'This account is closed.';end if;
 return me;end$$;
create or replace function public.beyond_admin(expected uuid)
returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;begin
 me:=public.beyond_actor(expected);
 if public.current_user_role()<>'admin' then raise exception 'Admin access required.';end if;
 return me;end$$;
create or replace function public.beyond_owner_open(target uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
begin
 return exists(select 1 from public.profiles p where p.id=target and p.age_blocked_at is null) and public.profile_age_band(target) not in ('under_13','not_given');
end$$;
create or replace function public.beyond_can_view(target uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.beyond_posts;me uuid;begin
 if jsonb_array_length(public.beyond_missing())<>0 then return false;end if;
 select * into p from public.beyond_posts where id=target;
 if not found or p.status='removed' or not public.beyond_owner_open(p.owner_id) then return false;end if;
 me:=public.my_profile_id();
 if auth.uid() is not null and (me is null or auth.role()<>'authenticated') then return false;end if;
 if me is not null and public.is_blocked_between(me,p.owner_id) then return false;end if;
 -- Owners/admin/confirmed supervision guardians inspect pending media even when the distribution switch is off.
 if me=p.owner_id or(me is not null and public.current_user_role()='admin') or(me is not null and public.is_supervising_guardian(p.owner_id)) then return true;end if;
 if not public.beyond_enabled() or p.status<>'approved' then return false;end if;
 if public.profile_age_band(p.owner_id)<>'adult' and p.audience<>'friends' then return false;end if;
 if not public.profile_item_visible(p.owner_id,'photo') then return false;end if;
 if p.audience='friends' then return me is not null and public.are_friends(me,p.owner_id);end if;
 return p.audience='everyone' and exists(select 1 from public.profiles pr where pr.id=p.owner_id and(pr.account_private=false or public.are_friends(me,p.owner_id)));
end$$;
create or replace function public.beyond_post_json(target uuid,admin_detail boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.beyond_posts;result jsonb;begin
 select * into p from public.beyond_posts where id=target;
 if not found then return null;end if;
 result:=jsonb_build_object('id',p.id,'creator_id',p.owner_id,'category',p.category,'caption',p.caption,'audience',p.audience,'status',p.status,'revision',p.revision,'created_at',p.created_at,'submitted_at',p.submitted_at,'rights_version',p.rights_version,'safety_version',p.safety_version,'attested_at',p.attested_at,'cleanup',p.cleanup,'media',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'position',m.position,'kind',m.kind,'path',m.path,'mime',m.mime,'bytes',m.bytes,'width',m.width,'height',m.height,'duration_ms',m.duration_ms) order by m.position) from public.beyond_media m where m.post_id=p.id),'[]'));
 if admin_detail or public.my_profile_id()=p.owner_id then result:=result||jsonb_build_object('review_reason',p.review_reason,'reviewed_at',p.reviewed_at,'cleanup_checked_at',p.cleanup_checked_at);end if;
 if admin_detail then result:=result||jsonb_build_object('report_count',(select count(*) from public.beyond_reports r where r.post_id=p.id));end if;
 return result;end$$;

create or replace function public.beyond_status(expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;begin
 me:=public.beyond_actor(expected_actor_id,true);
 return jsonb_build_object('enabled',public.beyond_enabled(),'missing',public.beyond_missing(),'actor_id',me,'can_submit',me is not null and public.beyond_enabled() and public.beyond_owner_open(me),'friends_only',me is null or public.profile_age_band(me)<>'adult','rights_version','beyond-rights-1','safety_version','beyond-safety-1');end$$;
create or replace function public.beyond_posts(expected_actor_id uuid,category text,max_rows integer default 30,before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;outrows jsonb;lastid uuid;n integer;begin
 me:=public.beyond_actor(expected_actor_id,true);
 if category is not null and category not in ('workout','service','learning','story') then raise exception 'Choose a category.';end if;
 n:=greatest(1,least(coalesce(max_rows,30),50));
 select coalesce(jsonb_agg(x.dto order by x.id desc),'[]'),(array_agg(x.id order by x.id))[1] into outrows,lastid from (
 select p.id,public.beyond_post_json(p.id) dto from public.beyond_posts p where p.status='approved' and(category is null or p.category=category) and(before_id is null or p.id<before_id) and public.beyond_enabled() and public.beyond_can_view(p.id) order by p.id desc limit n+1)x;
 -- Bounded opaque UUID pagination: return <=50, next cursor only when another row exists.
 if jsonb_array_length(outrows)>n then outrows:=outrows- n;lastid:=(outrows->(n-1)->>'id')::uuid;else lastid:=null;end if;
 return jsonb_build_object('posts',outrows,'next_id',lastid,'enabled',public.beyond_enabled());end$$;
-- Legacy discovery is independent of new contribution publication. reels_feed is an owner-privileged view,
-- not a privacy filter: explicitly check the exact linked athlete AND uploader before projecting card metadata.
-- Existing profile media uses the 'photo' audience; canonical reels have no per-reel audience column. Known
-- teen public discovery also needs current public-profile consent; accepted friends retain permitted media access.
-- No base reel/media URL, roster fallback, private profile fields or paid/Vault metadata leave this RPC.
create or replace function public.beyond_legacy_posts(expected_actor_id uuid, category text, max_rows integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare me uuid; legacy_category text; cards jsonb;
begin
  me := public.beyond_actor(expected_actor_id, true);
  if category is null or category not in ('workout', 'service') then
    raise exception 'Choose a legacy category: workout or service.';
  end if;
  if max_rows is null or max_rows < 1 or max_rows > 24 then
    raise exception 'Choose a legacy limit from 1 to 24.';
  end if;
  if jsonb_array_length(public.beyond_missing()) <> 0
    or to_regclass('public.reels_feed') is null
    or to_regprocedure('public.player_hidden_from_viewer(uuid)') is null
    or to_regprocedure('public.viewer_relationship(uuid)') is null
    or to_regprocedure('public.minor_has_consent(uuid,text)') is null then
    raise exception 'Legacy discovery is unavailable until its privacy dependencies are ready.';
  end if;
  legacy_category := case category when 'workout' then 'train_like_me' else 'serve_like_me' end;
  select coalesce(jsonb_agg(x.card order by x.created_at desc, x.id desc), '[]'::jsonb) into cards
  from (
    select f.id, f.created_at, jsonb_build_object('id', f.id,
      'title', left(coalesce(nullif(btrim(f.title), ''), case category when 'workout' then 'Workout' else 'Service' end), 240),
      'player_id', f.player_id, 'athlete_name', left(coalesce(nullif(btrim(a.full_name), ''), nullif(btrim(pl.name), ''), 'Athlete'), 160),
      'category', category) as card
    from public.reels_feed f
    join public.players pl on pl.id = f.player_id
    join public.profiles a on a.player_id = f.player_id and a.verification_status = 'verified'
    join public.profiles up on up.id = f.uploaded_by
    where f.category = legacy_category and f.tag_status = 'confirmed'
      and coalesce(f.is_removed, false) = false
      and coalesce(f.is_vault_only, false) = false and coalesce(f.is_exclusive, false) = false
      and case when coalesce(f.media_type, 'video') = 'photo_story'
        then coalesce(f.photo_count, 0) > 0 and coalesce(f.cover_path, '') <> ''
        else coalesce(f.video_url, '') <> '' end
      -- PRIV-01 skips its unique index for preexisting duplicate claims; never choose an alternate account.
      and not exists (select 1 from public.profiles other where other.player_id = f.player_id
        and other.verification_status = 'verified' and other.id <> a.id)
      and a.age_blocked_at is null and up.age_blocked_at is null
      and public.profile_age_band(a.id) not in ('under_13', 'not_given')
      and public.profile_age_band(up.id) not in ('under_13', 'not_given')
      and not public.player_hidden_from_viewer(f.player_id)
      and not public.is_blocked_between(me, a.id) and not public.is_blocked_between(me, up.id)
      and not public.is_blocked_between(a.id, up.id)
      and public.profile_item_visible(a.id, 'photo') and public.profile_item_visible(up.id, 'photo')
      and (public.profile_age_band(a.id) not in ('teen_13_15', 'teen_16_17')
        or public.viewer_relationship(a.id) in ('self', 'admin', 'guardian', 'friend')
        or public.minor_has_consent(a.id, 'public_profile'))
      and (public.profile_age_band(up.id) not in ('teen_13_15', 'teen_16_17')
        or public.viewer_relationship(up.id) in ('self', 'admin', 'guardian', 'friend')
        or public.minor_has_consent(up.id, 'public_profile'))
    order by f.created_at desc, f.id desc
    limit max_rows
  ) x;
  return cards;
end;
$$;

create or replace function public.beyond_my_posts(expected_actor_id uuid,max_rows integer default 30,before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;items jsonb;n integer;begin
 me:=public.beyond_actor(expected_actor_id);n:=greatest(1,least(coalesce(max_rows,30),50));
 select coalesce(jsonb_agg(x.dto order by x.id desc),'[]') into items from(select p.id,public.beyond_post_json(p.id) dto from public.beyond_posts p where p.owner_id=me and(before_id is null or p.id<before_id) order by p.id desc limit n+1)x;
 return jsonb_build_object('posts',case when jsonb_array_length(items)>n then items-n else items end,'next_id',case when jsonb_array_length(items)>n then items->(n-1)->>'id' else null end,'enabled',public.beyond_enabled());end$$;
create or replace function public.beyond_reserve(expected_actor_id uuid,request_id uuid,category text,caption text,audience text,media jsonb,rights_version text,safety_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;p public.beyond_posts;m jsonb;i integer:=0;kind text;mid uuid;extension text;oldmedia jsonb;begin
 me:=public.beyond_actor(expected_actor_id);
 if not public.beyond_enabled() then raise exception 'Beyond the Game is not switched on.';end if;
 if not public.beyond_owner_open(me) then raise exception 'Add an eligible age before submitting.';end if;
 if request_id is null or category is null or category not in ('workout','service','learning','story') or caption is null or char_length(btrim(caption)) not between 1 and 240 or audience is null or audience not in ('friends','everyone') then raise exception 'Check your post details.';end if;
 if public.profile_age_band(me)<>'adult' and audience<>'friends' then raise exception 'Choose friends for this account.';end if;
 if rights_version is distinct from 'beyond-rights-1' or safety_version is distinct from 'beyond-safety-1' then raise exception 'Review the current rights and safety notices.';end if;
 if jsonb_typeof(media) is distinct from 'array' or jsonb_array_length(media) not between 1 and 3 then raise exception 'Choose one video or up to three photos.';end if;
 for m in select value from jsonb_array_elements(media) loop
  if jsonb_typeof(m) is distinct from 'object' or exists(select 1 from jsonb_object_keys(m) k where k not in ('id','kind','bytes','width','height','duration_ms')) or jsonb_typeof(m->'id') is distinct from 'string' or jsonb_typeof(m->'kind') is distinct from 'string' or jsonb_typeof(m->'bytes') is distinct from 'number' or jsonb_typeof(m->'width') is distinct from 'number' or jsonb_typeof(m->'height') is distinct from 'number' then raise exception 'Check your media details.';end if;
  begin mid:=(m->>'id')::uuid;exception when others then raise exception 'Check your media id.';end;
  if (m->>'bytes') !~ '^[0-9]+$' or(m->>'width') !~ '^[0-9]+$' or(m->>'height') !~ '^[0-9]+$' or(m->>'bytes')::numeric not between 1 and 52428800 or(m->>'width')::numeric not between 1 and 4096 or(m->>'height')::numeric not between 1 and 4096 then raise exception 'Check your media limits.';end if;
  if m->>'kind'='photo' then
   if (m->>'bytes')::numeric>5242880 or m ? 'duration_ms' then raise exception 'Check your photo details.';end if;
  elsif m->>'kind'='video' then
   if jsonb_array_length(media)<>1 or jsonb_typeof(m->'duration_ms') is distinct from 'number' or(m->>'duration_ms') !~ '^[0-9]+$' or(m->>'duration_ms')::numeric not between 1 and 45000 then raise exception 'Choose a video of at most 45 seconds.';end if;
  else raise exception 'Choose JPEG photos or an MP4 video.';end if;
 end loop;
 if(select count(distinct value->>'id') from jsonb_array_elements(media))<>jsonb_array_length(media) then raise exception 'Choose distinct media.';end if;
 select * into p from public.beyond_posts bp where bp.owner_id=me and bp.request_id=beyond_reserve.request_id for update;
 if found then
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',bm.id,'kind',bm.kind,'bytes',bm.bytes,'width',bm.width,'height',bm.height,'duration_ms',bm.duration_ms)) order by bm.position) into oldmedia from public.beyond_media bm where bm.post_id=p.id;
  if p.category<>category or p.caption<>btrim(caption) or p.audience<>audience or oldmedia<>media then raise exception 'This request already contains different details.';end if;
  return public.beyond_post_json(p.id);
 end if;
 if(select count(*) from public.beyond_submission_quota q where q.owner_id=me and q.reserved_at>now()-interval '24 hours')>=5 then raise exception 'You can make 5 submissions per 24 hours. Try later.';end if;
 insert into public.beyond_submission_quota(owner_id,request_id) values(me,request_id);
 insert into public.beyond_posts(owner_id,owner_user_id,request_id,category,caption,audience,rights_version,safety_version) values(me,auth.uid(),request_id,category,btrim(caption),audience,rights_version,safety_version) returning * into p;
 for m in select value from jsonb_array_elements(media) loop
  mid:=(m->>'id')::uuid;kind:=m->>'kind';extension:=case when kind='photo' then 'jpg' else 'mp4' end;
  insert into public.beyond_media(id,post_id,position,kind,path,mime,bytes,width,height,duration_ms) values(mid,p.id,i,kind,auth.uid()::text||'/'||p.id::text||'/'||mid::text||'.'||extension,case when kind='photo' then 'image/jpeg' else 'video/mp4' end,(m->>'bytes')::bigint,(m->>'width')::integer,(m->>'height')::integer,(m->>'duration_ms')::integer);i:=i+1;
 end loop;
 return public.beyond_post_json(p.id);end$$;

create or replace function public.beyond_identity_removed()
returns trigger language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
begin
 if (old.owner_id is not null and new.owner_id is null) or(old.owner_user_id is not null and new.owner_user_id is null) then
  new.owner_id:=null;new.owner_user_id:=null;new.caption:='Removed account content';new.request_id:=gen_random_uuid();
  new.status:='removed';new.removed_at:=now();new.cleanup:='pending';new.revision:=old.revision+1;
  new.review_reason:=null;new.reviewer_id:=null;
  delete from public.beyond_reports where post_id=old.id;
  update public.beyond_admin_events set actor_id=null,reason='Account erasure; minimal action and time retained' where post_id=old.id;
 end if;
 return new;
end$$;
drop trigger if exists beyond_identity_removed on public.beyond_posts;
create trigger beyond_identity_removed before update on public.beyond_posts for each row execute function public.beyond_identity_removed();
create or replace function public.beyond_profile_erasure()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.beyond_admin_events set actor_id=null,reason='Account erasure; minimal action and time retained' where actor_id=old.id;
 update public.beyond_posts set reviewer_id=null,review_reason=case when review_reason is null then null else 'Review decision retained; reviewer identity erased' end where reviewer_id=old.id;
 update public.beyond_settings set changed_by=null,reason=null where changed_by=old.id;
 return old;
end$$;
drop trigger if exists beyond_profile_erasure on public.profiles;
create trigger beyond_profile_erasure before delete on public.profiles for each row execute function public.beyond_profile_erasure();
create or replace function public.beyond_export_my_data(expected_actor_id uuid,section text,max_rows integer default 30,before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;items jsonb;n integer;begin
 me:=public.beyond_actor(expected_actor_id);n:=greatest(1,least(coalesce(max_rows,30),50));
 if section='posts' then
  select coalesce(jsonb_agg(x.dto order by x.id desc),'[]') into items from(select p.id,public.beyond_post_json(p.id) dto from public.beyond_posts p where p.owner_id=me and(before_id is null or p.id<before_id) order by p.id desc limit n+1)x;
 elsif section='reports' then
  select coalesce(jsonb_agg(x.dto order by x.id desc),'[]') into items from(select r.id,jsonb_build_object('id',r.id,'post_id',r.post_id,'reason',r.reason,'created_at',r.created_at) dto from public.beyond_reports r where r.reporter_id=me and(before_id is null or r.id<before_id) order by r.id desc limit n+1)x;
 elsif section='quota' then
  select coalesce(jsonb_agg(x.dto order by x.id desc),'[]') into items from(select q.request_id id,jsonb_build_object('id',q.request_id,'reserved_at',q.reserved_at) dto from public.beyond_submission_quota q where q.owner_id=me and(before_id is null or q.request_id<before_id) order by q.request_id desc limit n+1)x;
 else raise exception 'Choose an export section.';end if;
 return jsonb_build_object('section',section,'items',case when jsonb_array_length(items)>n then items-n else items end,'next_id',case when jsonb_array_length(items)>n then items->(n-1)->>'id' else null end);
end$$;
create or replace function public.admin_beyond_erase_profile(expected_actor_id uuid,target_profile_id uuid,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;target_user uuid;ids jsonb;begin
 me:=public.beyond_admin(expected_actor_id);
 if reason is null or char_length(btrim(reason)) not between 5 and 240 then raise exception 'Add a support erasure reason.';end if;
 select user_id into target_user from public.profiles where id=target_profile_id for update;
 if not found then raise exception 'That account is unavailable.';end if;
 -- Root-approved exceptional support erasure resets the quota; ordinary owner removal never does.
 with targets as(select p.id from public.beyond_posts p where p.owner_id=target_profile_id order by p.id limit 50 for update),changed as(update public.beyond_posts p set owner_id=null,owner_user_id=null from targets t where p.id=t.id returning p.id) select coalesce(jsonb_agg(id),'[]') into ids from changed;
 delete from public.beyond_reports where reporter_id=target_profile_id;
 delete from public.beyond_submission_quota where owner_id=target_profile_id;
 update public.beyond_admin_events set actor_id=null,reason='Account erasure; minimal action and time retained' where actor_id=target_profile_id;
 update public.beyond_posts set reviewer_id=null,review_reason=case when review_reason is null then null else 'Review decision retained; reviewer identity erased' end where reviewer_id=target_profile_id;
 update public.beyond_settings set changed_by=null,reason=case when changed_by=target_profile_id then null else reason end where id and changed_by=target_profile_id;
 insert into public.beyond_admin_events(actor_id,action,reason) values(case when me=target_profile_id then null else me end,'retention','Support account erasure; media cleanup remains separately tracked');
 return jsonb_build_object('removed_post_ids',ids,'more',exists(select 1 from public.beyond_posts p where p.owner_id=target_profile_id),'cleanup_pending',true);
end$$;

-- Catalog-level INSERT/UPDATE guard closes upload/withdrawal races and defends against unrelated permissive policies.
create or replace function public.beyond_storage_guard()
returns trigger language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare m public.beyond_media;p public.beyond_posts;begin
 if tg_op='UPDATE' and old.bucket_id='beyond_game' then raise exception 'Beyond media is immutable.';end if;
 if new.bucket_id<>'beyond_game' then return new;end if;
 if tg_op='UPDATE' then raise exception 'Beyond media is immutable.';end if;
 select * into m from public.beyond_media where path=new.name;
 if not found then raise exception 'No reserved media path.';end if;
 select * into p from public.beyond_posts where id=m.post_id for update;
 if p.status<>'draft' or p.created_at<=now()-interval '24 hours' or not public.beyond_enabled() or not public.beyond_owner_open(p.owner_id) or auth.role()<>'authenticated' or auth.uid() is distinct from p.owner_user_id or new.owner is distinct from p.owner_user_id then raise exception 'This media reservation is not available.';end if;
 if new.metadata->>'mimetype' is distinct from m.mime or new.metadata->>'size' is distinct from m.bytes::text then raise exception 'The file metadata does not match its reservation.';end if;
 return new;end$$;
drop trigger if exists beyond_storage_guard on storage.objects;
create trigger beyond_storage_guard before insert or update on storage.objects for each row execute function public.beyond_storage_guard();
-- postgres cannot create an index on storage.objects (owner supabase_storage_admin).
-- (bucket_id, name, version) is already unique. The storage trigger above still guards writes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('beyond_game','beyond_game',false,52428800,array['image/jpeg','video/mp4']) on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['image/jpeg','video/mp4'];
create or replace function public.beyond_storage_allowed(object_path text,operation text)
returns boolean language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare m public.beyond_media;p public.beyond_posts;me uuid;begin
 select * into m from public.beyond_media where path=object_path;
 if not found then return false;end if;
 select * into p from public.beyond_posts where id=m.post_id;
 -- Storage DELETE needs SELECT visibility. Only a current open admin may access removed bytes for cleanup;
 -- no public/owner/guardian preview is restored, and beyond_media_access always refuses removed posts.
 if operation='read' then return public.beyond_can_view(p.id) or(p.status='removed' and public.my_profile_id() is not null and auth.role()='authenticated' and public.current_user_role()='admin');end if;
 me:=public.my_profile_id();
 if auth.role()<>'authenticated' or me is null then return false;end if;
 if operation='insert' then return p.owner_id=me and p.owner_user_id=auth.uid() and p.status='draft' and p.created_at>now()-interval '24 hours' and public.beyond_enabled() and public.beyond_owner_open(me);end if;
 if operation='delete' then return p.status='removed' and(me=p.owner_id or public.current_user_role()='admin');end if;
 return false;end$$;
-- Each restrictive guard constrains ANY existing generic permissive storage policy.
drop policy if exists "Beyond private read guard" on storage.objects;
create policy "Beyond private read guard" on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'beyond_game' or public.beyond_storage_allowed(name,'read'));
drop policy if exists "Beyond private insert guard" on storage.objects;
create policy "Beyond private insert guard" on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'beyond_game' or public.beyond_storage_allowed(name,'insert'));
drop policy if exists "Beyond private update guard" on storage.objects;
create policy "Beyond private update guard" on storage.objects as restrictive for update to authenticated using(bucket_id<>'beyond_game') with check(bucket_id<>'beyond_game');
drop policy if exists "Beyond private delete guard" on storage.objects;
create policy "Beyond private delete guard" on storage.objects as restrictive for delete to authenticated using(bucket_id<>'beyond_game' or public.beyond_storage_allowed(name,'delete'));
drop policy if exists "Beyond approved and inspection media" on storage.objects;
create policy "Beyond approved and inspection media" on storage.objects for select to anon,authenticated using(bucket_id='beyond_game' and public.beyond_storage_allowed(name,'read'));
drop policy if exists "Beyond reserved owner upload" on storage.objects;
create policy "Beyond reserved owner upload" on storage.objects for insert to authenticated with check(bucket_id='beyond_game' and public.beyond_storage_allowed(name,'insert'));
drop policy if exists "Beyond removed cleanup" on storage.objects;
create policy "Beyond removed cleanup" on storage.objects for delete to authenticated using(bucket_id='beyond_game' and public.beyond_storage_allowed(name,'delete'));

create or replace function public.beyond_finalize(expected_actor_id uuid,post_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;p public.beyond_posts;begin
 me:=public.beyond_actor(expected_actor_id);
 select * into p from public.beyond_posts where id=post_id and owner_id=me for update;
 if not found then raise exception 'That submission is unavailable.';end if;
 if not public.beyond_enabled() or not public.beyond_owner_open(me) then raise exception 'Beyond the Game is not switched on for this account.';end if;
 if p.status in ('pending','approved','held') then return public.beyond_post_json(p.id);end if;
 if p.status<>'draft' or p.created_at<=now()-interval '24 hours' then raise exception 'That draft is no longer available.';end if;
 if exists(select 1 from public.beyond_media m where m.post_id=p.id and not exists(select 1 from storage.objects o where o.bucket_id='beyond_game' and o.name=m.path and o.owner=p.owner_user_id and o.metadata->>'mimetype'=m.mime and o.metadata->>'size'=m.bytes::text)) then raise exception 'Upload the exact reserved files before submitting.';end if;
 update public.beyond_posts set status='pending',submitted_at=now(),revision=revision+1 where id=p.id;
 return public.beyond_post_json(p.id);end$$;
create or replace function public.beyond_remove(expected_actor_id uuid,post_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;p public.beyond_posts;begin
 me:=public.beyond_actor(expected_actor_id);
 select * into p from public.beyond_posts where id=post_id and owner_id=me for update;
 if not found then raise exception 'That submission is unavailable.';end if;
 if p.status<>'removed' then update public.beyond_posts set status='removed',removed_at=now(),cleanup='pending',revision=revision+1 where id=p.id;end if;
 return public.beyond_post_json(p.id);end$$;
create or replace function public.beyond_report(expected_actor_id uuid,post_id uuid,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;p public.beyond_posts;begin
 me:=public.beyond_actor(expected_actor_id);
 if reason is null or char_length(btrim(reason)) not between 5 and 240 then raise exception 'Add a short concern.';end if;
 select * into p from public.beyond_posts where id=post_id for update;
 if not found or p.owner_id=me then raise exception 'That submission is unavailable.';end if;
 if exists(select 1 from public.beyond_reports r where r.post_id=p.id and r.reporter_id=me) then return jsonb_build_object('received',true);end if;
 if not public.beyond_can_view(p.id) then raise exception 'That submission is unavailable.';end if;
 if(select count(*) from public.beyond_reports r where r.reporter_id=me and r.created_at>now()-interval '24 hours')>=20 then raise exception 'Report limit reached. Use Help for another concern.';end if;
 insert into public.beyond_reports(post_id,reporter_id,reason) values(p.id,me,btrim(reason));
 update public.beyond_posts set status='held',revision=revision+1 where id=p.id and status<>'removed';
 return jsonb_build_object('received',true);end$$;
create or replace function public.beyond_media_access(expected_actor_id uuid,post_id uuid,media_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;m public.beyond_media;begin
 me:=public.beyond_actor(expected_actor_id,true);
 if not public.beyond_can_view(post_id) then raise exception 'This media is unavailable.';end if;
 select * into m from public.beyond_media where id=media_id and public.beyond_media.post_id=beyond_media_access.post_id;
 if not found or not exists(select 1 from storage.objects o where o.bucket_id='beyond_game' and o.name=m.path and o.metadata->>'size'=m.bytes::text and o.metadata->>'mimetype'=m.mime) then raise exception 'This media is unavailable.';end if;
 return jsonb_build_object('bucket','beyond_game','path',m.path,'ttl_seconds',60,'post_id',post_id,'media_id',media_id);end$$;

create or replace function public.admin_beyond_status(expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;begin
 me:=public.beyond_admin(expected_actor_id);
 return jsonb_build_object('enabled',public.beyond_enabled(),'missing',public.beyond_missing(),'changed_at',(select changed_at from public.beyond_settings where id),'reason',(select reason from public.beyond_settings where id),'pending',(select count(*) from public.beyond_posts where status in ('pending','held')),'cleanup_pending',(select count(*) from public.beyond_posts where status='removed' and cleanup<>'complete'));
end$$;
create or replace function public.admin_beyond_set_enabled(expected_actor_id uuid,turn_on boolean,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;begin
 me:=public.beyond_admin(expected_actor_id);
 if turn_on is null or reason is null or char_length(btrim(reason)) not between 5 and 240 then raise exception 'Add a reason of 5 to 240 characters.';end if;
 if turn_on and jsonb_array_length(public.beyond_missing())>0 then raise exception 'Cannot switch on: missing %',public.beyond_missing();end if;
 update public.app_runtime_config set published=jsonb_set(published,'{highlights}',coalesce(published->'highlights','{}')||jsonb_build_object('beyondGameEnabled',turn_on)),updated_at=now(),published_at=now() where id='default';
 if not found then raise exception 'The runtime configuration is unavailable.';end if;
 update public.beyond_settings set changed_at=now(),changed_by=me,reason=btrim(reason) where id;
 insert into public.beyond_admin_events(actor_id,action,reason) values(me,case when turn_on then 'on' else 'off' end,btrim(reason));
 return public.admin_beyond_status(me);end$$;
create or replace function public.admin_beyond_posts(expected_actor_id uuid,status text default 'pending',max_rows integer default 30,before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;items jsonb;n integer;begin
 me:=public.beyond_admin(expected_actor_id);
 if status is null or status not in ('draft','pending','approved','held','removed') then raise exception 'Choose a review status.';end if;
 n:=greatest(1,least(coalesce(max_rows,30),50));
 select coalesce(jsonb_agg(x.dto order by x.id desc),'[]') into items from(select p.id,public.beyond_post_json(p.id,true) dto from public.beyond_posts p where p.status=admin_beyond_posts.status and(before_id is null or p.id<before_id) order by p.id desc limit n+1)x;
 return jsonb_build_object('posts',case when jsonb_array_length(items)>n then items-n else items end,'next_id',case when jsonb_array_length(items)>n then items->(n-1)->>'id' else null end,'enabled',public.beyond_enabled());end$$;
create or replace function public.admin_beyond_review(expected_actor_id uuid,post_id uuid,expected_revision integer,action text,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;p public.beyond_posts;begin
 me:=public.beyond_admin(expected_actor_id);
 if reason is null or char_length(btrim(reason)) not between 5 and 240 or action is null or action not in ('approve','remove') then raise exception 'Choose a decision and add a reason.';end if;
 select * into p from public.beyond_posts where id=post_id for update;
 if not found then raise exception 'That submission is unavailable.';end if;
 if expected_revision is null or p.revision<>expected_revision then raise exception 'This submission changed. Refresh and review again.';end if;
 if action='approve' then
  if not public.beyond_enabled() then raise exception 'Beyond the Game is not switched on.';end if;
  if not public.beyond_owner_open(p.owner_id) then raise exception 'The author account is closed or not eligible.';end if;
  if p.status not in ('pending','held') then raise exception 'Only submitted content can be approved.';end if;
  if public.profile_age_band(p.owner_id)<>'adult' and p.audience<>'friends' then raise exception 'This account can publish to friends only.';end if;
  if not public.beyond_can_view(p.id) then raise exception 'This media is unavailable to this reviewer.';end if;
  if exists(select 1 from public.beyond_media m where m.post_id=p.id and not exists(select 1 from storage.objects o where o.bucket_id='beyond_game' and o.name=m.path and o.owner=p.owner_user_id and o.metadata->>'mimetype'=m.mime and o.metadata->>'size'=m.bytes::text)) then raise exception 'The submitted files are unavailable.';end if;
 end if;
 update public.beyond_posts set status=case when action='approve' then 'approved' else 'removed' end,revision=revision+1,reviewed_at=now(),reviewer_id=me,review_reason=btrim(reason),removed_at=case when action='remove' then now() else removed_at end,cleanup=case when action='remove' then 'pending' else cleanup end where id=p.id;
 insert into public.beyond_admin_events(actor_id,post_id,action,reason) values(me,p.id,action,btrim(reason));
 return public.beyond_post_json(p.id,true);end$$;
create or replace function public.admin_beyond_cleanup_targets(expected_actor_id uuid,post_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;p public.beyond_posts;begin
 me:=public.beyond_admin(expected_actor_id);select * into p from public.beyond_posts where id=post_id for update;
 if not found or p.status<>'removed' then raise exception 'Remove the post before cleaning its files.';end if;
 return jsonb_build_object('post_id',p.id,'paths',coalesce((select jsonb_agg(m.path order by m.position) from public.beyond_media m where m.post_id=p.id),'[]'));
end$$;
create or replace function public.admin_beyond_cleanup_finish(expected_actor_id uuid,post_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;p public.beyond_posts;remaining integer;begin
 me:=public.beyond_admin(expected_actor_id);select * into p from public.beyond_posts where id=post_id for update;
 if not found or p.status<>'removed' then raise exception 'Remove the post before cleaning its files.';end if;
 select count(*) into remaining from public.beyond_media m join storage.objects o on o.bucket_id='beyond_game' and o.name=m.path where m.post_id=p.id;
 if remaining=0 and p.owner_id is null then delete from public.beyond_media where public.beyond_media.post_id=p.id;end if;
 update public.beyond_posts set cleanup=case when remaining=0 then 'complete' else 'partial' end,cleanup_checked_at=now() where id=p.id;
 insert into public.beyond_admin_events(actor_id,post_id,action,reason) values(me,p.id,'cleanup','Checked Storage catalog; physical provider deletion is separate evidence');
 return jsonb_build_object('post_id',p.id,'cleanup',case when remaining=0 then 'complete' else 'partial' end,'remaining',remaining,'basis','storage_catalog');end$$;
create or replace function public.admin_beyond_retention(expected_actor_id uuid,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare me uuid;ids jsonb;begin
 me:=public.beyond_admin(expected_actor_id);
 if reason is null or char_length(btrim(reason)) not between 5 and 240 then raise exception 'Add a retention reason.';end if;
 with expired as(select p.id from public.beyond_posts p where p.status='draft' and p.created_at<=now()-interval '24 hours' order by p.id limit 100 for update),changed as(update public.beyond_posts p set status='removed',removed_at=now(),cleanup='pending',revision=p.revision+1 from expired e where p.id=e.id returning p.id) select coalesce(jsonb_agg(id),'[]') into ids from changed;
 delete from public.beyond_submission_quota where reserved_at<now()-interval '35 days';
 delete from public.beyond_admin_events where created_at<now()-interval '2 years';
 insert into public.beyond_admin_events(actor_id,action,reason) values(me,'retention',btrim(reason));
 return jsonb_build_object('expired_post_ids',ids,'cleanup_pending',true);end$$;

-- Supabase defaults grant functions to every API role. Pin all new helper/RPC grants explicitly.
do $$declare f record;begin
 for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and(p.proname like 'beyond_%' or p.proname like 'admin_beyond_%') loop
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,f.args);
  if f.proname in('beyond_status','beyond_posts','beyond_media_access','beyond_storage_allowed','beyond_legacy_posts') then execute format('grant execute on function public.%I(%s) to anon,authenticated',f.proname,f.args);
  elsif f.proname in('beyond_my_posts','beyond_reserve','beyond_finalize','beyond_remove','beyond_report','admin_beyond_status','admin_beyond_set_enabled','admin_beyond_posts','admin_beyond_review','admin_beyond_cleanup_targets','admin_beyond_cleanup_finish','admin_beyond_retention','beyond_export_my_data','admin_beyond_erase_profile') then execute format('grant execute on function public.%I(%s) to authenticated',f.proname,f.args);
  end if;
 end loop;
end$$;
