-- A failed stop update must leave the previous plan intact. Locking the owner
-- also keeps simultaneous creations inside the 20-plan limit.
create function public.marketplace_save_plan(p_consumer uuid,p_id uuid,p_name text,p_note text,p_date date,p_group jsonb,p_items text[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.marketplace_plans%rowtype;
begin
 perform 1 from public.marketplace_consumers where id=p_consumer for update;
 if not found then raise exception 'identity_required'; end if;
 if coalesce(array_length(p_items,1),0)<1 or array_length(p_items,1)>12 or cardinality(p_items)<>(select count(distinct x) from unnest(p_items) x) then raise exception 'invalid_plan_items'; end if;
 if (select count(*) from public.marketplace_public_catalogue_items(p_items))<>cardinality(p_items) then raise exception 'plan_item_not_found'; end if;
 if p_id is not null then
  update public.marketplace_plans set name=p_name,note=p_note,planned_for=p_date,group_details=p_group,updated_at=now()
  where id=p_id and consumer_id=p_consumer returning * into result;
  if not found then raise exception 'plan_not_found'; end if;
  delete from public.marketplace_plan_items where plan_id=result.id;
 else
  if (select count(*) from public.marketplace_plans where consumer_id=p_consumer)>=20 then raise exception 'plan_limit_reached'; end if;
  insert into public.marketplace_plans(consumer_id,name,note,planned_for,group_details) values(p_consumer,p_name,p_note,p_date,p_group) returning * into result;
 end if;
 insert into public.marketplace_plan_items(plan_id,catalogue_item_id,position) select result.id,id,ordinality-1 from unnest(p_items) with ordinality as items(id,ordinality);
 return to_jsonb(result)-'consumer_id'-'share_token_hash';
end $$;
revoke all on function public.marketplace_save_plan(uuid,uuid,text,text,date,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.marketplace_save_plan(uuid,uuid,text,text,date,jsonb,text[]) to service_role;
