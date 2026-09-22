import { createClient } from "npm:@supabase/supabase-js@2";
import { bookingText, customerBookingEmail, escapeHtml, sendEmail, sendTelegram, sendZalo } from "../_shared/notify.ts";

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
    const { booking_code } = await req.json();
    if (!booking_code) return Response.json({error:"booking_code required"},{status:400,headers:cors});

    const db = createClient(Deno.env.get("SUPABASE_URL")!, secretKey());
    const { data: b, error } = await db.from("bookings").select("*").eq("booking_code", booking_code).single();
    if (error || !b) return Response.json({error:"Booking not found"},{status:404,headers:cors});

    const eventKey = "created";
    const results: Record<string,unknown> = {};

    async function already(channel:string) {
      const {data} = await db.from("notification_logs").select("id").eq("booking_id",b.id).eq("event_key",eventKey).eq("channel",channel).maybeSingle();
      return !!data;
    }
    async function log(channel:string, providerId="") {
      await db.from("notification_logs").upsert(
        {booking_id:b.id,event_key:eventKey,channel,provider_id:providerId||null},
        {onConflict:"booking_id,event_key,channel"}
      );
    }

    if (!(await already("telegram"))) {
      try { const r=await sendTelegram(bookingText(b)); results.telegram=r; if(!(r as any).skipped) await log("telegram",(r as any).id); }
      catch(e){ results.telegram={error:String(e)}; }
    }

    const adminEmail=Deno.env.get("ADMIN_EMAIL") || "anhnguyenst39@gmail.com";
    if (adminEmail && !(await already("email_admin"))) {
      try {
        const html=`<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(bookingText(b))}</pre>`;
        const r=await sendEmail(adminEmail,`Booking mới ${b.booking_code} · ${b.customer_name}`,html);
        results.email_admin=r;if(!(r as any).skipped)await log("email_admin",(r as any).id);
      } catch(e){ results.email_admin={error:String(e)}; }
    }

    if (b.customer_email && !(await already("email_customer"))) {
      try {
        const r=await sendEmail(b.customer_email,`Cheese.Graduation · Xác nhận ${b.booking_code}`,customerBookingEmail(b));
        results.email_customer=r;if(!(r as any).skipped)await log("email_customer",(r as any).id);
      } catch(e){ results.email_customer={error:String(e)}; }
    }

    const zaloTemplate=Deno.env.get("ZALO_ZBS_TEMPLATE_BOOKING");
    if (zaloTemplate && !(await already("zalo_customer"))) {
      try {
        const r=await sendZalo(b.phone,zaloTemplate,{
          customer_name:b.customer_name,
          booking_code:b.booking_code,
          shoot_date:b.shoot_date,
          time_slot:b.time_slot,
          photographer:b.photographer,
          package_name:b.package_name
        },`booking_${b.id}`);
        results.zalo_customer=r;if(!(r as any).skipped)await log("zalo_customer",(r as any).id);
      } catch(e){ results.zalo_customer={error:String(e)}; }
    }

    return Response.json({ok:true,results},{headers:{...cors,"Content-Type":"application/json"}});
  } catch(e) {
    return Response.json({ok:false,error:String(e)},{status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});
