-- Who may get an account. Supabase Auth calls this before it creates a new auth user (a first
-- Microsoft sign-in, a self sign-up, or the create-user function), and refuses when it returns an
-- error. An account is only created for someone who already has an active profile with the same
-- email, so a Microsoft account that Romsjef has not added gets nowhere. People who already have an
-- auth user are not affected: they are signed in (and their Microsoft identity linked) without a
-- new user being created.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email <> '' and exists (
    select 1
    from public.users u
    where lower(trim(u.email)) = v_email
      and u.is_active
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'Du er ikke registrert som beboer. Kontakt romsjef eller Data.'
    )
  );
end;
$function$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
