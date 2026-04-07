// Cloudflare Pages Function — /functions/notify.js
// Receives POST from the website, forwards to Telegram
// Runs server-side so no CORS issues and token stays hidden

const TG_TOKEN   = '8798074297:AAE5Jb9Yx0xrGeHnFYdz1tuE7b9MpLzxVn4';
const TG_CHAT_ID = '7676485257';
const TG_API     = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;

export async function onRequestPost(context) {
  // Allow requests from your own domain only
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { type, data } = body;

  let message = '';

  if (type === 'booking') {
    message =
      `📅 <b>NEW BOOKING REQUEST</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Name:</b> ${esc(data.name)}\n` +
      `📞 <b>Phone:</b> ${esc(data.phone)}\n` +
      `🔧 <b>Service:</b> ${esc(data.service)}\n` +
      `📍 <b>Pickup:</b> ${esc(data.from)}\n` +
      `🏁 <b>Drop-off:</b> ${esc(data.to || 'Not specified')}\n` +
      `🚗 <b>Vehicle:</b> ${esc(data.vehicle || 'Not specified')}\n` +
      `📆 <b>Date:</b> ${esc(data.date || 'Not specified')}\n` +
      `🕐 <b>Time:</b> ${esc(data.time || 'Not specified')}\n` +
      `📝 <b>Notes:</b> ${esc(data.notes || 'None')}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>Call back:</b> <a href="tel:${esc(data.phone)}">${esc(data.phone)}</a>`;
  } else if (type === 'chat') {
    message =
      `💬 <b>WEBSITE CHAT MESSAGE</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💬 <b>Message:</b> ${esc(data.message)}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚡ Reply via WhatsApp: https://wa.me/447548282598`;
  } else if (type === 'contact') {
    message =
      `✉️ <b>CONTACT FORM</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Name:</b> ${esc(data.name)}\n` +
      `📞 <b>Phone:</b> ${esc(data.phone)}\n` +
      `📋 <b>Subject:</b> ${esc(data.subject)}\n` +
      `💬 <b>Message:</b> ${esc(data.message)}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <a href="tel:${esc(data.phone)}">${esc(data.phone)}</a>`;
  } else {
    return new Response(JSON.stringify({ ok: false, error: 'Unknown type' }), { status: 400, headers });
  }

  // Send to Telegram
  const tgRes = await fetch(TG_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const tgJson = await tgRes.json();

  if (!tgJson.ok) {
    return new Response(JSON.stringify({ ok: false, tg: tgJson }), { status: 500, headers });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
