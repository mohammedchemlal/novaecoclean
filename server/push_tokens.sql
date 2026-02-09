-- Create table to store Expo push tokens per user
create table if not exists public.push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id integer not null,
  token text not null,
  updated_at timestamptz not null default now()
);

-- Unique index to avoid duplicates
create unique index if not exists push_tokens_user_token_idx on public.push_tokens (user_id, token);
