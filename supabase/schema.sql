-- schema.sql
-- WhatsApp Supervisor Demo MVP

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles (extending auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null,
  role text check (role in ('supervisor', 'agent')) not null default 'agent',
  created_at timestamp with time zone default now()
);

-- 2. Contacts (Leads/Customers from WhatsApp)
create table contacts (
  id uuid primary key default uuid_generate_v4(),
  phone text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Conversations (Shared Inbox)
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid references contacts(id) on delete cascade,
  status text check (status in ('new', 'assigned', 'pending', 'closed')) default 'new',
  assigned_to uuid references profiles(id) on delete set null,
  last_message_at timestamp with time zone default now(),
  last_message_preview text,
  unread_count integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. Messages
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  direction text check (direction in ('inbound', 'outbound', 'internal')) not null,
  content text,
  message_type text check (message_type in ('text', 'image', 'audio', 'video', 'document')) default 'text',
  provider_message_id text unique,
  sent_by_user_id uuid references profiles(id) on delete set null,
  status text check (status in ('sent', 'delivered', 'read', 'failed', 'received')),
  raw_payload jsonb,
  created_at timestamp with time zone default now()
);

-- 5. Internal Notes
create table internal_notes (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default now()
);

-- 6. System Events
create table system_events (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamp with time zone default now()
);

-- === Row Level Security (RLS) ===

alter table profiles enable row level security;
alter table contacts enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table internal_notes enable row level security;
alter table system_events enable row level security;

-- Profiles: Supervisors see all, agents see all profiles (to assign)
create policy "Profiles are viewable by authenticated users" 
on profiles for select to authenticated using (true);

-- Contacts: Viewable by all authenticated
create policy "Contacts are viewable by authenticated users" 
on contacts for select to authenticated using (true);

-- Conversations: View logic
-- Supervisor sees all. Agent sees only assigned to them OR 'new' (unassigned).
create policy "Conversations view policy" 
on conversations for select to authenticated using (
  (select role from profiles where id = auth.uid()) = 'supervisor' 
  or assigned_to = auth.uid() 
  or status = 'new'
);

create policy "Conversations update policy"
on conversations for update to authenticated using (
  (select role from profiles where id = auth.uid()) = 'supervisor'
  or assigned_to = auth.uid()
);

-- Messages: View logic
create policy "Messages view policy"
on messages for select to authenticated using (
  exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
    and (
      (select role from profiles where id = auth.uid()) = 'supervisor'
      or c.assigned_to = auth.uid()
      or c.status = 'new'
    )
  )
);

create policy "Messages insert policy (Outbound/Internal)"
on messages for insert to authenticated with check (
  direction in ('outbound', 'internal')
);

-- Notes: View logic
create policy "Notes view policy"
on internal_notes for select to authenticated using (
  exists (
    select 1 from conversations c
    where c.id = internal_notes.conversation_id
    and (
      (select role from profiles where id = auth.uid()) = 'supervisor'
      or c.assigned_to = auth.uid()
    )
  )
);

-- Triggers for last_updated etc. can be added here
