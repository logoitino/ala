/** MONEY-TIPS-01 service quote regressions: no charge or secret before immutable server-owned allocation admission. */
import { serverDonationContextAdapter } from '../../../../../supabase/functions/_shared/money/serverDonationContext.ts';
import { runCreatePaymentIntent } from '../../../../../supabase/functions/_shared/money/paymentIntent.ts';

const donorId='00000000-0000-0000-0000-000000000001', athleteId='00000000-0000-0000-0000-000000000002';
const context={ id:'00000000-0000-0000-0000-000000000003', donorId,athleteId,purpose:'donation',currency:'usd',
  giftCents:5000,coverFeeCents:50,platformTipCents:500,totalCents:5550,livemode:false,notificationAuthority:false } as const;
function setup(rpc?: Parameters<typeof serverDonationContextAdapter>[0], extras=true) {
  const create=jest.fn(async()=>({id:'pi_tip_test',livemode:false,client_secret:'local_test_secret'}));
  const input={userId:donorId,body:{amount:extras?5550:5000,playerId:athleteId,platformTipCents:extras?500:0,
    donation:{giftCents:5000,coverFees:extras,platformTipPercent:extras?10:0}},
    isTargetFrozen:async()=>({data:false,error:null}),getStripe:()=>({paymentIntents:{create}}),
    donationContext:serverDonationContextAdapter(rpc)};
  return {create,input};
}

it('missing service key refuses even a declared plain gift before creating an intent',async()=>{
  const {input,create}=setup(undefined,false);expect((await runCreatePaymentIntent(input)).status).toBe(503);expect(create).not.toHaveBeenCalled();
});
it.each(['monetization_tips_disabled','processing_estimate_unavailable','processing_estimate_out_of_bounds','payment_context_invalid','42883'])('service quote error %s is bounded and refuses before charge',async code=>{
  const rpc=jest.fn(async()=>({data:null,error:{code}}));const {input,create}=setup(rpc);
  expect(await runCreatePaymentIntent(input)).toEqual({status:503,body:{error:'Payment context unavailable.'}});expect(create).not.toHaveBeenCalled();
});
it('server quote binds actual actor and allocation before returning only the existing client secret',async()=>{
  const rpc=jest.fn(async(name:string)=>({data:name==='prepare_tip_payment_context'?context:true,error:null}));
  const {input,create}=setup(rpc);expect(await runCreatePaymentIntent(input)).toEqual({status:200,body:{clientSecret:'local_test_secret'}});
  expect(rpc.mock.calls[0]).toEqual(['prepare_tip_payment_context',{donor_user_id:donorId,athlete_id:athleteId,gift_cents:5000,cover_fees:true,platform_tip_percent:10}]);
  expect(rpc.mock.calls[1]).toEqual(['record_notification_payment_context',{context_id:context.id,provider_intent_id:'pi_tip_test',donor_user_id:donorId,
    athlete_id:athleteId,gift_cents:5000,cover_fee_cents:50,platform_tip_cents:500,currency_code:'usd',provider_livemode:false}]);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({amount:5550,metadata:expect.objectContaining({tapuai_notification_authority:'false',tapuai_gift_cents:'5000',tapuai_cover_fee_cents:'50',tapuai_platform_tip_cents:'500'})}));
});
it('changed published estimate makes the client quote stale before charge',async()=>{
  const {input,create}=setup(async()=>({data:{...context,coverFeeCents:51,totalCents:5551},error:null}));
  expect((await runCreatePaymentIntent(input)).status).toBe(503);expect(create).not.toHaveBeenCalled();
});
it('provider context persistence failure withholds every payable secret',async()=>{
  const {input}=setup(async(name:string)=>name==='prepare_tip_payment_context'?{data:context,error:null}:{data:null,error:{code:'40001'}});
  expect(await runCreatePaymentIntent(input)).toEqual({status:503,body:{error:'Payment context unavailable.'}});
});
it('legacy plain gift without configured quote remains accepted without admitting extras',async()=>{
  const {input,create}=setup(undefined,false);const result=await runCreatePaymentIntent({...input,donationContext:undefined});expect(result.status).toBe(200);expect(create).toHaveBeenCalledTimes(1);
});
