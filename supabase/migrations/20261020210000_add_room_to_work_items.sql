-- Work done on a room: regi entries and tasks can name the room they are about. The regi approval
-- flow is unchanged, so Regisjef confirms the work before it counts.
alter table public.work_items
  add column if not exists room_id uuid references public.rooms(id) on delete set null;

create index if not exists work_items_room_id_idx on public.work_items (room_id) where room_id is not null;
