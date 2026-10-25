-- Pin search_path on three functions flagged by the Supabase linter (function_search_path_mutable).
-- None of them reads a table or calls a non-built-in function, so an empty path is enough.
alter function public.reset_vakt_swap_on_reassign() set search_path = '';
alter function public.room_capacity(text) set search_path = '';
alter function public.room_reports_set_resolved_at() set search_path = '';
