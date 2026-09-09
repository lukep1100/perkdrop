-- Candidate release SQL; tested on isolated Postgres before deployment.
alter table public.merchant_commercial_terms drop constraint merchant_commercial_terms_model_check;
alter table public.merchant_commercial_terms add constraint merchant_commercial_terms_model_check
check(model in ('none','cpa','revenue_share','cpc','subscription','affiliate','hybrid','per_unit','per_booking','percentage_of_tracked_value'));

-- AUD amounts rounded once per redemption. Percentage base is actual post-discount
-- tracked value. Legacy cpa means per unit; revenue_share means percentage.
-- Subscription/monthly hybrid fees are not multiplied by redemptions.
create or replace function public.marketplace_fee(p_model text,p_units integer,p_tracked_net numeric,p_flat numeric,p_rate numeric)
returns numeric language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if p_units is null or p_units<1 or coalesce(p_tracked_net,0)<0 or coalesce(p_flat,0)<0 or coalesce(p_rate,0)<0 or coalesce(p_rate,0)>1 then raise exception 'invalid_fee_inputs'; end if;
  return round(case
    when p_model in ('per_unit','cpa') then coalesce(p_flat,0)*p_units
    when p_model='per_booking' then coalesce(p_flat,0)
    when p_model in ('percentage_of_tracked_value','revenue_share') then coalesce(p_tracked_net,0)*coalesce(p_rate,0)
    when p_model='hybrid' then coalesce(p_flat,0)*p_units+coalesce(p_tracked_net,0)*coalesce(p_rate,0)
    when p_model in ('none','subscription','cpc','affiliate') then 0
    else null end,2);
end $$;
revoke all on function public.marketplace_fee(text,integer,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.marketplace_fee(text,integer,numeric,numeric,numeric) to service_role;

create or replace function public.redeem_merchant_redemption_with_spend(p_merchant_id uuid,p_redemption_code text,p_merchant_reference text default null,p_eligible_food_subtotal numeric default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.redemptions%rowtype; o public.merchant_offers%rowtype; t public.merchant_commercial_terms%rowtype;
  gross numeric; discount numeric; net numeric; fee numeric:=0; basis text;
begin
  if p_eligible_food_subtotal is not null and (p_eligible_food_subtotal<0 or p_eligible_food_subtotal>100000) then raise exception 'invalid_eligible_food_subtotal'; end if;
  select * into r from public.redemptions where merchant_id=p_merchant_id and redemption_code=upper(trim(p_redemption_code)) for update;
  if not found then raise exception 'redemption_not_found'; end if;
  if r.status<>'created' then raise exception 'redemption_not_available'; end if;
  if r.expires_at<=now() then raise exception 'redemption_expired'; end if;
  if (r.metadata->>'valid_from')::timestamptz>now() then raise exception 'service_not_started'; end if;
  select * into o from public.merchant_offers where id=r.merchant_offer_id and merchant_id=p_merchant_id;
  gross:=coalesce(p_eligible_food_subtotal,r.gross_value);
  discount:=coalesce(r.discount_value,0);
  basis:=coalesce(r.metadata->>'value_basis','legacy_post_discount');
  if p_eligible_food_subtotal is not null then
    basis:='gross_before_discount';
    if o.discount_type='percent' and o.discount_percent is not null then discount:=round(gross*o.discount_percent/100,2); end if;
  end if;
  if o.discount_type='percent' and gross is null then raise exception 'eligible_spend_required'; end if;
  net:=case when basis='gross_before_discount' then greatest(0,gross-discount) else gross end;
  select * into t from public.merchant_commercial_terms where merchant_id=p_merchant_id and status='active' and effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc,created_at desc limit 1;
  if found then
    if t.model in ('percentage_of_tracked_value','revenue_share','hybrid') and coalesce(t.commission_rate,0)>0 and net is null then raise exception 'tracked_value_required'; end if;
    fee:=public.marketplace_fee(t.model,r.party_size,net,t.commission_flat,t.commission_rate);
    if fee is null then raise exception 'unsupported_commercial_model'; end if;
  end if;
  update public.redemptions set status='redeemed',redeemed_at=now(),merchant_reference=coalesce(nullif(trim(p_merchant_reference),''),merchant_reference),
    gross_value=gross,discount_value=discount,commission_value=fee,updated_at=now(),
    metadata=metadata||jsonb_build_object('value_basis',basis,'tracked_net',net,'commercial_term_id',t.id,'fee_model',coalesce(t.model,'none'),'spend_captured',p_eligible_food_subtotal is not null)
    where id=r.id returning * into r;
  if fee>0 then
    insert into public.commission_ledger(merchant_id,redemption_id,entry_type,gross_value,perkdrop_value,merchant_value,currency,status,occurred_at,metadata)
    values(r.merchant_id,r.id,'commission',gross,fee,net-fee,r.currency,'approved',now(),jsonb_build_object('commercial_term_id',t.id,'fee_model',t.model,'party_size',r.party_size,'tracked_net',net,'discount_value',discount,'merchant_offer_id',r.merchant_offer_id))
    on conflict(redemption_id) where redemption_id is not null do nothing;
  end if;
  return to_jsonb(r);
end $$;

-- All merchant entry points share the same service-window checks and fee function.
create or replace function public.redeem_merchant_redemption(p_merchant_id uuid,p_redemption_code text,p_merchant_reference text default null)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
  select public.redeem_merchant_redemption_with_spend(p_merchant_id,p_redemption_code,p_merchant_reference,null);
$$;
revoke all on function public.redeem_merchant_redemption(uuid,text,text),public.redeem_merchant_redemption_with_spend(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.redeem_merchant_redemption(uuid,text,text),public.redeem_merchant_redemption_with_spend(uuid,text,text,numeric) to service_role;
