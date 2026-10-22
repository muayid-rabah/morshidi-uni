begin;

do $migration$
declare
  v_expression text;
  v_compact text;
  v_expected_original constant text :=
    'delivery_terminal_reasonisnullordelivery_terminal_reason=anyarray[''unsupported_event''::text,''http_rejected''::text,''invalid_event''::text]';
  v_expected_reconciled constant text :=
    'delivery_terminal_reasonisnullordelivery_terminal_reason=anyarray[''unsupported_event''::text,''http_rejected''::text,''invalid_event''::text,''historical_cutover''::text]';
begin
  select pg_get_expr(c.conbin, c.conrelid, true)
    into v_expression
    from pg_catalog.pg_constraint c
   where c.conrelid = 'public.events'::regclass
     and c.conname = 'events_terminal_reason_check'
     and c.contype = 'c';

  if v_expression is null then
    raise exception using message = 'EXPECTED_EVENTS_TERMINAL_REASON_CHECK_MISSING';
  end if;

  v_compact := regexp_replace(lower(v_expression), '[[:space:]()]', '', 'g');
  if v_compact = v_expected_original then
    alter table public.events drop constraint events_terminal_reason_check;
    alter table public.events add constraint events_terminal_reason_check
      check (delivery_terminal_reason is null or delivery_terminal_reason in
        ('unsupported_event', 'http_rejected', 'invalid_event', 'historical_cutover'));
  elsif v_compact = v_expected_reconciled then
    -- Production may already have the reviewed manual schema correction.
    -- Recording this migration must preserve that schema and every archived row.
    null;
  else
    raise exception using
      message = 'UNEXPECTED_EVENTS_TERMINAL_REASON_CHECK',
      detail = v_expression;
  end if;
end
$migration$;

commit;
