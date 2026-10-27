-- StageFlow: close the implicit anonymous execute privilege on the protected portfolio writer.
begin;
revoke all on function public.stage_save_musician_portfolio_v4(
  text,text,text,text[],text[],text,text,numeric,boolean,
  text,text,text,text,text,text,integer,text[],text[],text,
  text[],text,text,text
) from PUBLIC,anon,authenticated;
grant execute on function public.stage_save_musician_portfolio_v4(
  text,text,text,text[],text[],text,text,numeric,boolean,
  text,text,text,text,text,text,integer,text[],text[],text,
  text[],text,text,text
) to authenticated;
commit;
notify pgrst,'reload schema';
