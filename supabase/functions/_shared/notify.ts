
type Booking = {
  id: string;
  booking_code: string;
  customer_name: string;
  phone: string;
  customer_email?: string | null;
  school?: string | null;
  class_name?: string | null;
  group_size: string;
  photographer: string;
  package_name: string;
  shoot_date: string;
  time_slot: string;
  status: string;
  deposit_amount: number;
  deposit_status: string;
};

export function vnPhone(input: string) {
  let p = String(input || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "84" + p.slice(1);
  if (!p.startsWith("84")) p = "84" + p;
  return p;
}

export function statusVi(status: string) {
  return ({
    new: "Mới",
    contacted: "Đã liên hệ",
    deposit_pending: "Chờ cọc",
    confirmed: "Đã chốt",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    rejected: "Từ chối"
  } as Record<string,string>)[status] || status;
}

export function depositVi(status: string) {
  return ({
    unpaid: "Chưa cọc",
    partial: "Cọc một phần",
    paid: "Đã cọc đủ",
    refunded: "Đã hoàn cọc"
  } as Record<string,string>)[status] || status;
}

export function vnd(amount: number | string) {
  return new Intl.NumberFormat("vi-VN").format(Number(amount || 0)) + "đ";
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export function bookingText(b: Booking) {
  return [
    `🔔 BOOKING MỚI — Cheese.Graduation`,
    ``,
    `Mã: ${b.booking_code}`,
    `Khách: ${b.customer_name}`,
    `SĐT: ${b.phone}`,
    `Trường/Lớp: ${[b.school,b.class_name].filter(Boolean).join(" · ") || "—"}`,
    `Ngày: ${b.shoot_date} · ${b.time_slot}`,
    `Photographer: ${b.photographer}`,
    `Gói: ${b.package_name}`,
    `Số lượng: ${b.group_size}`
  ].join("\n");
}

export function adminStatusText(b: Booking) {
  return [
    `✏️ CẬP NHẬT BOOKING — Cheese.Graduation`,
    ``,
    `Mã: ${b.booking_code}`,
    `Khách: ${b.customer_name}`,
    `Trạng thái: ${statusVi(b.status)}`,
    `Cọc: ${depositVi(b.deposit_status)} · ${vnd(b.deposit_amount)}`,
    `Ngày: ${b.shoot_date} · ${b.time_slot}`,
    `Photographer: ${b.photographer}`
  ].join("\n");
}

export async function sendTelegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return { skipped: true };
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const data = await r.json();
  if (!r.ok || data?.ok === false) throw new Error(`Telegram: ${data?.description || r.status}`);
  return { id: String(data?.result?.message_id || "") };
}

export async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!key || !from || !to) return { skipped: true };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {"Content-Type":"application/json","Authorization":`Bearer ${key}`},
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Email: ${data?.message || r.status}`);
  return { id: String(data?.id || "") };
}

export async function sendZalo(phone: string, templateId: string | undefined, templateData: Record<string,unknown>, trackingId: string) {
  const token = Deno.env.get("ZALO_ACCESS_TOKEN");
  if (!token || !templateId || !phone) return { skipped: true };
  const r = await fetch("https://business.openapi.zalo.me/message/template", {
    method: "POST",
    headers: {"Content-Type":"application/json","access_token":token},
    body: JSON.stringify({
      phone: vnPhone(phone),
      template_id: templateId,
      template_data: templateData,
      tracking_id: trackingId
    })
  });
  const data = await r.json();
  if (!r.ok || Number(data?.error || 0) !== 0) throw new Error(`Zalo: ${data?.message || data?.error || r.status}`);
  return { id: String(data?.data?.msg_id || data?.data?.message_id || trackingId) };
}

export function customerBookingEmail(b: Booking) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#173d5d">
    <h1 style="font-size:26px">Cheese.Graduation</h1>
    <p>Chào <b>${escapeHtml(b.customer_name)}</b>, yêu cầu đặt lịch của bạn đã được ghi nhận.</p>
    <div style="padding:18px;border-radius:14px;background:#f7f0e3">
      <p><b>Mã booking:</b> ${escapeHtml(b.booking_code)}</p>
      <p><b>Ngày:</b> ${escapeHtml(b.shoot_date)} · ${escapeHtml(b.time_slot)}</p>
      <p><b>Photographer:</b> ${escapeHtml(b.photographer)}</p>
      <p><b>Gói:</b> ${escapeHtml(b.package_name)}</p>
    </div>
    <p>Ekip sẽ liên hệ lại để xác nhận lịch và tiền cọc.</p>
  </div>`;
}

export function customerStatusEmail(b: Booking) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#173d5d">
    <h1 style="font-size:26px">Cheese.Graduation</h1>
    <p>Booking <b>${escapeHtml(b.booking_code)}</b> vừa được cập nhật.</p>
    <div style="padding:18px;border-radius:14px;background:#f7f0e3">
      <p><b>Trạng thái:</b> ${escapeHtml(statusVi(b.status))}</p>
      <p><b>Tiền cọc:</b> ${escapeHtml(depositVi(b.deposit_status))} · ${escapeHtml(vnd(b.deposit_amount))}</p>
      <p><b>Ngày:</b> ${escapeHtml(b.shoot_date)} · ${escapeHtml(b.time_slot)}</p>
      <p><b>Photographer:</b> ${escapeHtml(b.photographer)}</p>
    </div>
  </div>`;
}
