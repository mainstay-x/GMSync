-- GMSync · Obras, categorias, equipes e lançamentos
-- Rodar depois de 001-whatsapp.sql, no SQL Editor do projeto Supabase do GMSync.

-- ---------------------------------------------------------------------------
-- Acesso: quem entra no GMSync
-- ---------------------------------------------------------------------------
create table if not exists public.gmsync_profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique,
  display_name  text,
  role          text not null default 'admin' check (role in ('admin', 'viewer')),
  created_at    timestamptz not null default now()
);

create or replace function public.gmsync_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gmsync_profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------------
create table if not exists public.gmsync_projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  aliases     text[] not null default '{}',   -- outros nomes usados no dia a dia
  client      text,
  location    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.gmsync_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  guidance    text,                            -- o que entra nela; a IA lê este texto
  position    integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.gmsync_teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  aliases     text[] not null default '{}',   -- apelidos e nomes falados nos áudios
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.gmsync_categories (name, guidance, position) values
  ('Material bruto', 'Cimento, areia, brita, tijolo, bloco, ferro, vergalhão, madeira de obra, argamassa, cal, tubos e conexões de esgoto e água.', 1),
  ('Acabamentos',    'Pisos, revestimentos, rejunte, tintas, massa corrida, louças e metais comuns, portas, rodapés, esquadrias.', 2),
  ('Gesso',          'Placas de gesso, drywall, perfis, sancas, molduras, massa e cola de gesso.', 3),
  ('Elétrica',       'Fios, cabos, eletrodutos, disjuntores, quadros, tomadas, interruptores e lâmpadas comuns.', 4),
  ('Requinte',       'Itens de alto padrão que valorizam o imóvel: spots e trilhos de luz, fitas de LED decorativas, torneiras gourmet, fechadura eletrônica, cubas e metais de design, automação.', 5)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Lançamentos: tudo o que entra pelo WhatsApp vira um lançamento
-- ---------------------------------------------------------------------------
alter table public.gmsync_whatsapp_messages
  add column if not exists process_status text not null default 'pending'
    check (process_status in ('pending', 'done', 'awaiting_transcription', 'skipped', 'error')),
  add column if not exists process_error text,
  add column if not exists transcript text;      -- texto do áudio, transcrito pela OpenAI

create table if not exists public.gmsync_entries (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid unique references public.gmsync_whatsapp_messages (id) on delete set null,
  sender_id       uuid references public.gmsync_whatsapp_senders (id) on delete set null,
  project_id      uuid references public.gmsync_projects (id) on delete set null,
  kind            text not null check (kind in ('photo', 'diary', 'purchase', 'labor', 'other')),
  summary         text not null,
  text_content    text,                        -- texto da mensagem ou transcrição do áudio
  media_path      text,                        -- arquivo no bucket gmsync-whatsapp
  occurred_on     date,
  needs_review    boolean not null default false,
  review_reasons  text[] not null default '{}',
  ai_model        text,
  ai_output       jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists gmsync_entries_project_idx on public.gmsync_entries (project_id, created_at desc);
create index if not exists gmsync_entries_review_idx  on public.gmsync_entries (needs_review) where needs_review;

-- Nota de compra: um cabeçalho e os itens, cada item com a sua categoria.
create table if not exists public.gmsync_purchases (
  entry_id         uuid primary key references public.gmsync_entries (id) on delete cascade,
  supplier         text,
  document_number  text,
  purchase_date    date,
  total            numeric(14, 2)
);

create table if not exists public.gmsync_purchase_items (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.gmsync_entries (id) on delete cascade,
  position     integer not null default 0,
  description  text not null,
  quantity     numeric(14, 3),
  unit         text,
  unit_price   numeric(14, 2),
  total        numeric(14, 2),
  category_id  uuid references public.gmsync_categories (id) on delete set null
);

create index if not exists gmsync_purchase_items_entry_idx on public.gmsync_purchase_items (entry_id);

-- Mão de obra: cada linha vai para uma equipe.
create table if not exists public.gmsync_labor (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.gmsync_entries (id) on delete cascade,
  team_id      uuid references public.gmsync_teams (id) on delete set null,
  team_heard   text,                           -- nome como foi dito, quando não bate com o cadastro
  description  text not null,
  amount       numeric(14, 2),
  days         numeric(8, 2)
);

create index if not exists gmsync_labor_entry_idx on public.gmsync_labor (entry_id);

-- ---------------------------------------------------------------------------
-- Permissões: o administrador lê, edita e exclui tudo. Mais ninguém acessa.
-- ---------------------------------------------------------------------------
alter table public.gmsync_profiles       enable row level security;
alter table public.gmsync_projects       enable row level security;
alter table public.gmsync_categories     enable row level security;
alter table public.gmsync_teams          enable row level security;
alter table public.gmsync_entries        enable row level security;
alter table public.gmsync_purchases      enable row level security;
alter table public.gmsync_purchase_items enable row level security;
alter table public.gmsync_labor          enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'gmsync_profiles', 'gmsync_projects', 'gmsync_categories', 'gmsync_teams',
    'gmsync_entries', 'gmsync_purchases', 'gmsync_purchase_items', 'gmsync_labor',
    'gmsync_whatsapp_senders', 'gmsync_whatsapp_contacts', 'gmsync_whatsapp_messages'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.gmsync_is_admin()) with check (public.gmsync_is_admin())',
      t || '_admin', t
    );
  end loop;
end $$;

-- Cada usuário enxerga o próprio perfil (para a tela saber quem entrou).
drop policy if exists gmsync_profiles_self on public.gmsync_profiles;
create policy gmsync_profiles_self on public.gmsync_profiles
  for select to authenticated using (user_id = auth.uid());

-- Fotos e documentos recebidos: o administrador abre e exclui.
drop policy if exists gmsync_whatsapp_files_admin on storage.objects;
create policy gmsync_whatsapp_files_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'gmsync-whatsapp' and public.gmsync_is_admin())
  with check (bucket_id = 'gmsync-whatsapp' and public.gmsync_is_admin());
