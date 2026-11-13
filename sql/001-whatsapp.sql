-- GMSync · WhatsApp (Cloud API da Meta)
-- Rodar uma vez no SQL Editor do projeto Supabase do GMSync.
-- As tabelas ficam fechadas para o navegador: só as Edge Functions,
-- com a chave service_role, leem e gravam.

-- Números autorizados a enviar dados ao sistema. Mensagem de qualquer outro
-- número é descartada pelo webhook.
create table if not exists public.gmsync_whatsapp_senders (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null check (phone ~ '^[0-9]{8,15}$'),  -- com DDI, só dígitos: 5521999998888
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  -- A Meta costuma entregar celulares do Brasil sem o nono dígito.
  -- A comparação usa sempre o número sem ele.
  match_key   text generated always as (
    case when phone ~ '^55[0-9]{2}9[0-9]{8}$'
         then substr(phone, 1, 4) || substr(phone, 6)
         else phone end
  ) stored unique
);

create table if not exists public.gmsync_whatsapp_contacts (
  wa_id            text primary key,            -- número como a Meta envia, só dígitos
  profile_name     text,
  first_seen_at    timestamptz not null default now(),
  last_inbound_at  timestamptz                  -- abre a janela de 24 horas
);

create table if not exists public.gmsync_whatsapp_messages (
  id               uuid primary key default gen_random_uuid(),
  wa_message_id    text not null unique,        -- id da Meta (wamid...)
  direction        text not null check (direction in ('in', 'out')),
  wa_id            text not null references public.gmsync_whatsapp_contacts (wa_id),
  sender_id        uuid references public.gmsync_whatsapp_senders (id),
  phone_number_id  text not null,
  type             text not null,
  body             text,
  payload          jsonb not null,
  status           text not null
                   check (status in ('received', 'accepted', 'sent', 'delivered', 'read', 'failed')),
  error_code       integer,
  error_title      text,
  -- Foto, áudio, vídeo ou documento: arquivo guardado no bucket gmsync-whatsapp.
  media_id         text,
  media_mime       text,
  media_path       text,
  media_error      text,
  wa_timestamp     timestamptz,
  sent_at          timestamptz,
  delivered_at     timestamptz,
  read_at          timestamptz,
  failed_at        timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists gmsync_whatsapp_messages_contact_idx
  on public.gmsync_whatsapp_messages (wa_id, created_at desc);

alter table public.gmsync_whatsapp_senders  enable row level security;
alter table public.gmsync_whatsapp_contacts enable row level security;
alter table public.gmsync_whatsapp_messages enable row level security;
-- Sem policies de propósito: anon e authenticated não acessam nada.

-- Arquivos recebidos, em bucket privado.
insert into storage.buckets (id, name, public)
values ('gmsync-whatsapp', 'gmsync-whatsapp', false)
on conflict (id) do nothing;

-- Cadastro dos dois números iniciais (trocar pelos números reais antes de rodar):
-- insert into public.gmsync_whatsapp_senders (phone, name) values
--   ('5521999998888', 'Nome 1'),
--   ('5521988887777', 'Nome 2');
