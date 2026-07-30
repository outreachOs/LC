// Cloudflare Worker entry point — worker/index.js
//
// This project deploys as a Worker with Static Assets (wrangler.jsonc has
// both a "main" script and an "assets" block), built and shipped via
// `wrangler deploy` / `wrangler versions upload` — NOT Cloudflare Pages.
// Pages Functions (a "/functions" directory of onRequestPost-style
// exports) is a Cloudflare Pages-only convention and is never invoked in
// this setup, regardless of the compatibility flags set here — that is
// why the previous functions/notify.js file was never actually running.
//
// With a Worker + assets configured this way, the platform's default
// behaviour (run_worker_first left at its default of false) already does
// the right thing without any extra routing config: any request that
// matches a real static file is served directly from the assets bucket,
// and only requests with no matching asset — such as POST /notify, which
// is not a file on disk — reach this fetch handler. So the only logic
// this Worker needs is: handle /notify, and otherwise hand the request
// to env.ASSETS.fetch() to serve the site exactly as before.
//
// Required Cloudflare Worker secrets (set via the dashboard or
// `wrangler secret put`, NOT committed to the repo):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://www.leicester-car-recovery.co.uk',
  'https://leicester-car-recovery.co.uk',
]);

// Cloudflare Worker preview/version URLs follow the documented format
// <VERSION_PREFIX_OR_ALIAS>-<WORKER_NAME>.<ACCOUNT_SUBDOMAIN>.workers.dev
// (see https://developers.cloudflare.com/workers/configuration/previews/).
// <ACCOUNT_SUBDOMAIN> is specific to your Cloudflare account and isn't
// knowable from this codebase, so this pattern matches on the worker name
// ("kris") appearing directly before the account-subdomain segment,
// whatever that subdomain turns out to be, rather than guessing it.
// Verify this actually matches your real preview URLs once deployed —
// if your account subdomain contains characters outside [a-z0-9-], widen
// the second capture group accordingly.
const ALLOWED_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+-kris\.[a-z0-9-]+\.workers\.dev$/i;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  return ALLOWED_PREVIEW_ORIGIN.test(origin);
}

function corsHeaders(origin) {
  const headers = { 'Content-Type': 'application/json' };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

function jsonError(message, status, origin) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: corsHeaders(origin),
  });
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Trims a value to a string, enforcing a maximum length. Returns null if a
// required value is missing/empty.
function field(raw, { required = false, maxLen = 500 } = {}) {
  const value = (raw === undefined || raw === null) ? '' : String(raw).trim();
  if (required && !value) return null;
  return value.slice(0, maxLen);
}

const PHONE_PATTERN = /^[0-9 +]{10,14}$/;

async function handleNotify(request, env) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonError('Method not allowed.', 405, origin);
  }

  // Reject requests whose Origin (or, failing that, Referer) isn't the
  // production site or this Worker's own preview URLs. Legitimate
  // same-origin POSTs made via fetch() always carry an Origin header in
  // modern browsers, so this does not affect genuine visitors submitting
  // a form.
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch (e) {
      requestOrigin = null;
    }
  }
  if (!isAllowedOrigin(requestOrigin)) {
    return jsonError('Request not permitted from this origin.', 403, origin);
  }

  // Reasonable payload size ceiling before we even try to parse it.
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 20000) {
    return jsonError('Request too large.', 413, origin);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    return jsonError('Content-Type must be application/json.', 400, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError('Invalid JSON.', 400, origin);
  }

  const { type, data } = body || {};
  if (!data || typeof data !== 'object') {
    return jsonError('Missing lead data.', 400, origin);
  }

  let message;

  if (type === 'booking') {
    const name = field(data.name, { required: true, maxLen: 100 });
    const phone = field(data.phone, { required: true, maxLen: 30 });
    const service = field(data.service, { required: true, maxLen: 100 });
    const from = field(data.from, { required: true, maxLen: 200 });
    if (name === null || phone === null || service === null || from === null) {
      return jsonError('Missing required booking fields.', 400, origin);
    }
    if (!PHONE_PATTERN.test(phone.replace(/\s/g, ''))) {
      return jsonError('Please provide a valid UK phone number.', 400, origin);
    }
    const to = field(data.to, { maxLen: 200 }) || 'Not specified';
    const vehicle = field(data.vehicle, { maxLen: 100 }) || 'Not specified';
    const date = field(data.date, { maxLen: 30 }) || 'Not specified';
    const time = field(data.time, { maxLen: 50 }) || 'Not specified';
    const notes = field(data.notes, { maxLen: 1000 }) || 'None';

    message =
      `📅 <b>NEW BOOKING REQUEST</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Name:</b> ${esc(name)}\n` +
      `📞 <b>Phone:</b> ${esc(phone)}\n` +
      `🔧 <b>Service:</b> ${esc(service)}\n` +
      `📍 <b>Pickup:</b> ${esc(from)}\n` +
      `🏁 <b>Drop-off:</b> ${esc(to)}\n` +
      `🚗 <b>Vehicle:</b> ${esc(vehicle)}\n` +
      `📆 <b>Date:</b> ${esc(date)}\n` +
      `🕐 <b>Time:</b> ${esc(time)}\n` +
      `📝 <b>Notes:</b> ${esc(notes)}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>Call back:</b> <a href="tel:${esc(phone)}">${esc(phone)}</a>`;

  } else if (type === 'contact') {
    const name = field(data.name, { required: true, maxLen: 100 });
    const phone = field(data.phone, { required: true, maxLen: 30 });
    const message_ = field(data.message, { required: true, maxLen: 2000 });
    if (name === null || phone === null || message_ === null) {
      return jsonError('Missing required contact fields.', 400, origin);
    }
    if (!PHONE_PATTERN.test(phone.replace(/\s/g, ''))) {
      return jsonError('Please provide a valid UK phone number.', 400, origin);
    }
    const subject = field(data.subject, { maxLen: 100 }) || 'Not specified';

    message =
      `✉️ <b>CONTACT FORM</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Name:</b> ${esc(name)}\n` +
      `📞 <b>Phone:</b> ${esc(phone)}\n` +
      `📋 <b>Subject:</b> ${esc(subject)}\n` +
      `💬 <b>Message:</b> ${esc(message_)}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <a href="tel:${esc(phone)}">${esc(phone)}</a>`;

  } else if (type === 'chat') {
    const chatMessage = field(data.message, { required: true, maxLen: 2000 });
    if (chatMessage === null) {
      return jsonError('Missing chat message.', 400, origin);
    }

    message =
      `💬 <b>WEBSITE CHAT</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💬 <b>Message:</b> ${esc(chatMessage)}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚡ Reply: https://wa.me/447865449983`;

  } else if (type === 'callback') {
    const name = field(data.name, { required: true, maxLen: 100 });
    const phone = field(data.phone, { required: true, maxLen: 30 });
    if (name === null || phone === null) {
      return jsonError('Missing required callback fields.', 400, origin);
    }
    if (!PHONE_PATTERN.test(phone.replace(/\s/g, ''))) {
      return jsonError('Please provide a valid UK phone number.', 400, origin);
    }
    const jobType = data.jobType === 'prebook' ? 'prebook' : 'callback';
    const label = jobType === 'prebook' ? '📅 PRE-BOOK REQUEST' : '📞 CALLBACK REQUEST';

    message =
      `${label}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Name:</b> ${esc(name)}\n` +
      `📞 <b>Phone:</b> ${esc(phone)}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <a href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a>`;

  } else {
    return jsonError('Unknown lead type.', 400, origin);
  }

  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  // Log whether each secret is present — booleans only, never the actual
  // values — so a 500 here can be diagnosed from Cloudflare's Worker logs
  // without ever risking the token/chat ID appearing in a log line.
  console.error('worker/index.js: secret presence check', {
    hasToken: Boolean(token),
    hasChatId: Boolean(chatId),
  });

  if (!token || !chatId) {
    // Do not leak configuration details to the browser — log server-side
    // only (visible in Cloudflare's Worker logs) and return a generic error.
    console.error('worker/index.js: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secret binding — has this Worker had the secrets set via `wrangler secret put` / the dashboard Variables and Secrets screen?');
    return jsonError('Lead notification is temporarily unavailable. Please call instead.', 500, origin);
  }

  let tgRes;
  let tgBodyText;
  let tgJson;
  try {
    tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    // Read as text first so we can still log something useful even if
    // Telegram ever returns a non-JSON body (e.g. an HTML error page
    // during an outage) — JSON.parse on that would otherwise throw here
    // and land us in the generic catch block below with less detail.
    tgBodyText = await tgRes.text();
    try {
      tgJson = JSON.parse(tgBodyText);
    } catch (parseErr) {
      console.error('worker/index.js: Telegram response was not valid JSON', {
        status: tgRes.status,
        statusText: tgRes.statusText,
        bodyText: tgBodyText,
      });
      return jsonError('Lead notification is temporarily unavailable. Please call instead.', 502, origin);
    }
  } catch (e) {
    // Real exception from the fetch() call itself (network failure, DNS,
    // timeout, etc.) — log the actual error server-side only.
    console.error('worker/index.js: Telegram request threw an exception', {
      message: e && e.message,
      name: e && e.name,
      stack: e && e.stack,
    });
    return jsonError('Lead notification is temporarily unavailable. Please call instead.', 502, origin);
  }

  if (!tgJson || tgJson.ok !== true) {
    // Log the real Telegram API status and response body server-side only —
    // this is where Telegram tells you *why* it rejected the message (bad
    // token, bot not started/blocked, wrong chat_id, etc.) — never forward
    // any of this to the browser.
    console.error('worker/index.js: Telegram API rejected the message', {
      status: tgRes.status,
      statusText: tgRes.statusText,
      body: tgJson,
    });
    return jsonError('Lead notification is temporarily unavailable. Please call instead.', 502, origin);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: corsHeaders(origin),
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/notify') {
      return handleNotify(request, env);
    }

    // Everything else is the static site — served from the assets bucket
    // configured in wrangler.jsonc. In normal operation the platform
    // already serves matching static files before this Worker ever runs
    // (run_worker_first defaults to false), so in practice this line is
    // mainly reached for genuine 404s; env.ASSETS.fetch() handles those
    // the same way a plain static-assets deployment would.
    return env.ASSETS.fetch(request);
  },
};
