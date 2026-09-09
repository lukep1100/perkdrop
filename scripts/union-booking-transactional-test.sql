-- Run against the PerkDrop database. All fixture changes are rolled back.
begin;

do $$
declare
  v_merchant uuid;
  v_offer uuid;
  v_date date := current_date + 7;
  v_hold jsonb;
  v_result jsonb;
  v_token uuid;
  v_code text := 'PD-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,8));
  v_size integer;
  v_remaining integer;
  v_blocked boolean;
begin
  insert into public.merchants (name,slug,primary_state,primary_city,primary_location,booking_url)
  values ('PerkDrop booking audit fixture','perkdrop-booking-audit-'||substr(md5(random()::text),1,8),'SA','adelaide','Test only','https://bookings.nowbookit.com/?venueid=5582')
  returning id into v_merchant;

  insert into public.merchant_offers (merchant_id,title,description,discount_type,discount_percent,conditions,starts_at,ends_at,recurring_schedule,location,city,state,booking_url,status,action_type,metadata)
  values (v_merchant,'Transactional booking audit','Test only','percent',20,'Test only',now()-interval '1 day',now()+interval '30 days','{"days":["monday","tuesday","wednesday","thursday"],"capacity_per_service":20}'::jsonb,'Test only','adelaide','SA','https://bookings.nowbookit.com/?venueid=5582','active','booking_claim','{"test_fixture":true}'::jsonb)
  returning id into v_offer;

  insert into public.offer_sessions (merchant_offer_id,service_date,service_start,service_end,capacity_total,capacity_remaining,status,metadata)
  values (v_offer,v_date,'11:30','14:30',20,20,'active','{"test_fixture":true}'::jsonb);

  -- Every supported customer party size decrements and releases exactly.
  for v_size in 1..6 loop
    v_hold := public.create_booking_hold(v_offer,v_date,'audit-size-'||v_size,v_size,10);
    if (v_hold->>'capacity_remaining')::int <> 20-v_size then raise exception 'party size % decrement failed',v_size; end if;
    v_token := (v_hold#>>'{hold,hold_token}')::uuid;
    v_result := public.release_booking_hold(v_token,'audit-size-'||v_size);
    if not (v_result->>'released')::boolean or (v_result->>'capacity_remaining')::int <> 20 then raise exception 'party size % release failed',v_size; end if;
  end loop;

  -- Four holds consume all 20 spots; the next request must be blocked.
  perform public.create_booking_hold(v_offer,v_date,'audit-sold-1',6,10);
  perform public.create_booking_hold(v_offer,v_date,'audit-sold-2',6,10);
  perform public.create_booking_hold(v_offer,v_date,'audit-sold-3',6,10);
  perform public.create_booking_hold(v_offer,v_date,'audit-sold-4',2,10);
  select capacity_remaining into v_remaining from public.offer_sessions where merchant_offer_id=v_offer and service_date=v_date;
  if v_remaining <> 0 then raise exception 'sold-out capacity should be zero'; end if;
  v_blocked := false;
  begin perform public.create_booking_hold(v_offer,v_date,'audit-sold-blocked',1,10);
  exception when others then if sqlerrm like '%insufficient_capacity%' then v_blocked:=true; else raise; end if; end;
  if not v_blocked then raise exception 'sold-out session accepted another hold'; end if;
  perform public.release_booking_hold((select hold_token from public.booking_claim_holds where merchant_offer_id=v_offer and session_id='audit-sold-1'),'audit-sold-1');
  perform public.release_booking_hold((select hold_token from public.booking_claim_holds where merchant_offer_id=v_offer and session_id='audit-sold-2'),'audit-sold-2');
  perform public.release_booking_hold((select hold_token from public.booking_claim_holds where merchant_offer_id=v_offer and session_id='audit-sold-3'),'audit-sold-3');
  perform public.release_booking_hold((select hold_token from public.booking_claim_holds where merchant_offer_id=v_offer and session_id='audit-sold-4'),'audit-sold-4');

  -- An expired hold is reclaimed by the next atomic hold operation.
  v_hold := public.create_booking_hold(v_offer,v_date,'audit-expired',4,10);
  update public.booking_claim_holds set expires_at=now()-interval '1 second' where hold_token=(v_hold#>>'{hold,hold_token}')::uuid;
  v_result := public.create_booking_hold(v_offer,v_date,'audit-after-expiry',3,10);
  if (v_result->>'capacity_remaining')::int <> 17 then raise exception 'expired capacity was not restored'; end if;
  if not exists(select 1 from public.booking_claim_holds where merchant_offer_id=v_offer and session_id='audit-expired' and status='expired') then raise exception 'expired hold status not recorded'; end if;
  perform public.release_booking_hold((v_result#>>'{hold,hold_token}')::uuid,'audit-after-expiry');

  -- Successful booking confirmation creates one unique code with the held party size.
  v_hold := public.create_booking_hold(v_offer,v_date,'audit-confirm',5,10);
  v_token := (v_hold#>>'{hold,hold_token}')::uuid;
  v_result := public.confirm_booking_hold(v_token,'audit-confirm',v_code,'NBI-AUDIT','{"nowbookit_event":{"event_category":"Booking","event_action":"Booking Confirmed"}}'::jsonb);
  if v_result#>>'{redemption,redemption_code}' <> v_code then raise exception 'claim code mismatch'; end if;
  if (v_result#>>'{redemption,party_size}')::int <> 5 then raise exception 'confirmed party size mismatch'; end if;
  if (select capacity_remaining from public.offer_sessions where merchant_offer_id=v_offer and service_date=v_date) <> 15 then raise exception 'confirmation changed held capacity incorrectly'; end if;
  -- Future service must not be redeemable yet. Advance only this isolated fixture's
  -- entitlement window, then exercise spend capture through the production RPC.
  v_blocked := false;
  begin perform public.redeem_merchant_redemption(v_merchant,v_code,'merchant-audit');
  exception when others then if sqlerrm like '%service_not_started%' then v_blocked:=true; else raise; end if; end;
  if not v_blocked then raise exception 'future service redeemed early'; end if;
  update public.redemptions set metadata=metadata||jsonb_build_object('valid_from',now()-interval '1 hour') where redemption_code=v_code;
  v_result := public.redeem_merchant_redemption_with_spend(v_merchant,v_code,'merchant-audit',84);
  if v_result->>'status' <> 'redeemed' or (v_result->>'party_size')::int <> 5 then raise exception 'merchant redemption did not preserve party size'; end if;
end $$;

rollback;

select jsonb_build_object(
  'passed',true,
  'party_sizes','1-6',
  'hold_release','passed',
  'expiry_restoration','passed',
  'sold_out','passed',
  'confirmation_and_unique_code','passed',
  'merchant_redemption_party_size','passed',
  'persisted_fixtures',(select count(*) from public.merchants where name='PerkDrop booking audit fixture')
) as union_booking_transactional_test;
