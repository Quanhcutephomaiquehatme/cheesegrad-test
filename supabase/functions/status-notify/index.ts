import { createClient } from "npm:@supabase/supabase-js@2";
import { adminStatusText, customerStatusEmail, depositVi, sendEmail, sendTelegram, sendZalo, statusVi, vnd } from "../_shared/notify.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function secretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const json = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (json) return JSON.parse(json)?.default;
  throw new Error("Missing Supabase secret key");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i,"");
    if (!token) return Response.json({error:"Unauthorized"},{status:401,headers:cors});

    const url=Deno.env.get("SUPABASE_URL")!, secret=secretKey();
    const db=createClient(url,secret);
    const {data:{user},error:userErr}=await db.auth.getUser(token);
    if(userErr||!user?.email)return Response.json({error:"Unauthorized"},{status:401,headers:cors});

    const {data:admin}=await db.from("admin_users").select("email").ilike("email",user.email).maybeSingle();
    if(!admin)return Response.json({error:"Forbidden"},{status:403,headers:cors});

    const {booking_id,force=false}=await req.json();
    const {data:b,error}=await db.from("bookings").select("*").eq("id",booking_id).single();
    if(error||!b)return Response.json({error:"Booking not found"},{status:404,headers:cors});

    // Event key changes with customer-facing state; "force" can resend manually.
    const baseKey=`status:${b.status}|deposit:${b.deposit_status}|amount:${b.deposit_amount}`;
    const eventKey=force?`${baseKey}|force:${Date.now()}`:baseKey;
    const results:Record<string,unknown>={};

    async function already(channel:string){
      if(force)return false;
      const {data}=await db.from("notification_logs").select("id").eq("booking_id",b.id).eq("event_key",eventKey).eq("channel",channel).maybeSingle();
      return !!data;
    }
    async function log(channel:string,providerId=""){
      await db.from("notification_logs").upsert(
        {booking_id:b.id,event_key:eventKey,channel,provider_id:providerId||null},
        {onConflict:"booking_id,event_key,channel"}
      );
    }

    if(!(await already("telegram"))){
      try{const r=await sendTelegram(adminStatusText(b));results.telegram=r;if(!(r as any).skipped)await log("telegram",(r as any).id)}
      catch(e){results.telegram={error:String(e)}}
    }

    if(b.customer_email && !(await already("email_customer"))){
      try{
        const r=await sendEmail(b.customer_email,`Cheese.Graduation · Cập nhật ${b.booking_code}`,customerStatusEmail(b));
        results.email_customer=r;if(!(r as any).skipped)await log("email_customer",(r as any).id)
      }catch(e){results.email_customer={error:String(e)}}
    }

    const zaloTemplate=Deno.env.get("ZALO_ZBS_TEMPLATE_STATUS");
    if(zaloTemplate && !(await already("zalo_customer"))){
      try{
        const r=await sendZalo(b.phone,zaloTemplate,{
          customer_name:b.customer_name,
          booking_code:b.booking_code,
          booking_status:statusVi(b.status),
          deposit_status:depositVi(b.deposit_status),
          deposit_amount:vnd(b.deposit_amount),
          shoot_date:b.shoot_date,
          time_slot:b.time_slot,
          photographer:b.photographer
        },`status_${b.id}_${Date.now()}`);
        results.zalo_customer=r;if(!(r as any).skipped)await log("zalo_customer",(r as any).id)
      }catch(e){results.zalo_customer={error:String(e)}}
    }

    return Response.json({ok:true,results},{headers:cors});
  }catch(e){
    return Response.json({ok:false,error:String(e)},{status:500,headers:cors});
  }
});
