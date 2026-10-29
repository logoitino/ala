-- Highlight category: Game Play / Train Like Me / Serve Like Me (2× Aura).
-- Safe to re-run. Serve Like Me doubles double-tap Aura on the feed.

alter table public.reels add column if not exists category text not null default 'game_play';

alter table public.reels drop constraint if exists reels_category_check;
alter table public.reels add constraint reels_category_check
  check (category in ('game_play', 'train_like_me', 'serve_like_me'));
