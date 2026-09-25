/* ═══════════════════════════════════════
   KRIS RECOVERY — main.js
   Flat file structure — no subfolders
   Telegram via direct API (works on
   Cloudflare Pages / any static host)
   ═══════════════════════════════════════ */

// Lead notifications are sent via the server-side /notify Cloudflare Pages
// Function (see functions/notify.js), which holds the Telegram credentials.
// The browser never sees the bot token or chat ID.
async function sendLead(type, data) {
  try {
    const res = await fetch('/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    });
    const json = await res.json();
    return json.ok === true;
  } catch (e) {
    console.warn('Lead notification error:', e);
    return false;
  }
}

/* ══════════════════════
   ANALYTICS & CONVERSION TRACKING
   This file is loaded on every page of the site, so everything below
   runs site-wide — there is no per-page setup and no page is excluded.

   Google Tag Manager (GTM-TXZHJP3C) is loaded via the static snippet
   in the <head> and <body> of every HTML page — it, not this file, is
   the single mechanism that talks to Google. GA4 and Google Ads tags
   (config + conversions) are configured entirely inside the GTM
   container/console, not in code, so there is nothing here to swap
   out if those tags change.

   This file's only job is to push structured events onto the
   dataLayer that GTM's own snippet already initialises:
     - phone_click            — every tel: link click, site-wide
     - callback_submit_success — every successful booking/callback
                                  form submit (fires with the /notify
                                  webhook)
   GTM triggers on these event names to fire whatever GA4/Ads tags are
   configured for them — nothing here can duplicate a tag load, since
   this file never loads gtag.js or registers a destination itself.

   No dynamic-number-insertion / call-tracking swap is implemented on
   the phone number anywhere in this file — 07865 449983 is the one
   number shown and dialled everywhere on the site.
   ══════════════════════ */

// Pushes one structured event onto GTM's dataLayer. Defensive dataLayer
// init in case this ever runs before GTM's own snippet has (it won't,
// in normal page order, but this keeps the push from throwing either way).
function pushDataLayerEvent(eventName, params) {
  window.dataLayer = window.dataLayer || [];
  try { window.dataLayer.push(Object.assign({ event: eventName }, params || {})); } catch (e) {}
}

// Best-effort label for which on-page element a tel: link belongs to,
// based on existing CSS classes/containers — no markup changes needed.
function telLinkLocation(a) {
  var cls = ' ' + (a.className || '') + ' ';
  if (cls.indexOf(' nav-phone ') !== -1) return 'header_nav';
  if (cls.indexOf(' mobile-call ') !== -1) return 'mobile_nav';
  if (cls.indexOf(' float-call ') !== -1) return 'floating_button';
  if (cls.indexOf(' slb-call ') !== -1) return 'sticky_bar';
  if (cls.indexOf(' footer-phone-link ') !== -1) return 'footer';
  if (cls.indexOf(' guide-cta ') !== -1) return 'guide_card';
  if (a.closest && a.closest('.topbar')) return 'top_bar';
  if (a.closest && a.closest('.emg-strip')) return 'emergency_strip';
  if (a.closest && a.closest('.callback-drawer')) return 'callback_drawer';
  if (a.closest && a.closest('.chat-window')) return 'chat_widget';
  if (cls.indexOf(' btn-emergency ') !== -1 && cls.indexOf(' btn-xl ') !== -1) return 'hero_cta';
  if (cls.indexOf(' btn-emergency ') !== -1) return 'emergency_button';
  if (cls.indexOf(' btn-primary ') !== -1) return 'primary_button';
  if (cls.indexOf(' btn-dark ') !== -1) return 'dark_button';
  return 'content';
}

// One delegated listener, site-wide, covers every tel: link on every
// page — including clicks landing on a child <span>/emoji inside the
// anchor. Capture phase so it runs before the dialer opens. Exactly
// one phone_click dataLayer push per click — never duplicated. The
// number itself (07865 449983) is never rewritten — this only
// observes clicks on the existing tel: links, it doesn't touch what
// they display or dial.
document.addEventListener('click', function (e) {
  var a = (e.target && e.target.closest) ? e.target.closest('a[href]') : null;
  if (!a) return;
  if ((a.getAttribute('href') || '').indexOf('tel:') === 0) {
    pushDataLayerEvent('phone_click', {
      page_path: window.location.pathname,
      link_location: telLinkLocation(a)
    });
  }
}, true);

// ── MOBILE MENU ──
function toggleMenu() {
  const nav = document.getElementById('mobileNav');
  if (nav) nav.classList.toggle('open');
}

// ── FAQ ──
function toggleFaq(btn) {
  const item = btn.parentElement;
  const was  = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
  if (!was) item.classList.add('open');
}

// ── CHAT ──
const BOT_REPLIES = [
  "Thanks! Kris will see this shortly. For emergencies please call <strong>07865 449983</strong> directly — he answers 24/7 🚨",
  "Got it. For urgent jobs, calling is always fastest: <strong>07865 449983</strong>. Kris answers personally.",
  "Message received! You can also reach Kris on WhatsApp using the button above.",
  "Thanks for getting in touch. For live breakdowns always call <strong>07865 449983</strong> — much faster than chat."
];
let botIdx = 0;

function toggleChat() {
  const win   = document.getElementById('chatWindow');
  const badge = document.getElementById('chatBadge');
  if (!win) return;
  win.classList.toggle('open');
  if (badge) badge.classList.remove('show');
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const msgs  = document.getElementById('chatMsgs');
  if (!input || !msgs) return;

  const text = input.value.trim();
  if (!text) return;

  msgs.innerHTML += `<div class="cmsg user">${escHtml(text)}</div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;

  // Send to lead notification endpoint (server-side formats the Telegram message)
  sendLead('chat', { message: text });

  setTimeout(() => {
    msgs.innerHTML += `<div class="cmsg bot">${BOT_REPLIES[botIdx % BOT_REPLIES.length]}</div>`;
    botIdx++;
    msgs.scrollTop = msgs.scrollHeight;
  }, 1000);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'chatInput') {
    e.preventDefault();
    sendChat();
  }
});

window.addEventListener('load', function () {
  setTimeout(function () {
    const badge = document.getElementById('chatBadge');
    const win   = document.getElementById('chatWindow');
    if (badge && win && !win.classList.contains('open')) {
      badge.classList.add('show');
    }
  }, 12000);
});

// ── CALENDAR ──
let selDate  = null;
let calYear, calMonth;

function initCalendar(containerId) {
  const now = new Date();
  calYear   = now.getFullYear();
  calMonth  = now.getMonth();
  renderCalendar(containerId);
}

function renderCalendar(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const now    = new Date();
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const first  = new Date(calYear, calMonth, 1).getDay();
  const total  = new Date(calYear, calMonth + 1, 0).getDate();

  let html = `<div class="cal-wrap">
    <div class="cal-header">
      <button class="cal-nav" onclick="changeMonth('${containerId}',-1)" type="button">&#8249;</button>
      <div class="cal-title">${MONTHS[calMonth]} ${calYear}</div>
      <button class="cal-nav" onclick="changeMonth('${containerId}',1)" type="button">&#8250;</button>
    </div>
    <div class="cal-grid">`;

  DAYS.forEach(d => { html += `<div class="cal-dh">${d}</div>`; });
  for (let i = 0; i < first; i++) { html += `<div class="cal-d empty"></div>`; }

  for (let d = 1; d <= total; d++) {
    const dt      = new Date(calYear, calMonth, d);
    const isPast  = dt < today;
    const isToday = dt.getTime() === today.getTime();
    const str     = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSel   = selDate === str;
    const cls     = [isPast?'past':'', isToday?'today':'', isSel?'selected':''].filter(Boolean).join(' ');
    const click   = isPast ? '' : `onclick="pickDate('${str}','${containerId}')"`;
    html += `<div class="cal-d ${cls}" ${click}>${d}</div>`;
  }

  html += `</div></div>`;
  el.innerHTML = html;
}

function changeMonth(containerId, dir) {
  calMonth += dir;
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  renderCalendar(containerId);
}

function pickDate(str, containerId) {
  selDate = str;
  const h = document.getElementById('bDate');
  if (h) h.value = str;
  renderCalendar(containerId);
  const ts = document.getElementById('timeSlotSection');
  if (ts) ts.style.display = 'block';
}

function selectTime(el, time) {
  document.querySelectorAll('.tslot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  el.dataset.time = time;
}

// ── BOOKING SUBMIT ──
async function submitBooking() {
  const g = id => (document.getElementById(id)||{}).value?.trim()||'';
  const name    = g('bName');
  const phone   = g('bPhone');
  const service = g('bService');
  const from    = g('bFrom');
  const to      = g('bTo');
  const vehicle = g('bVehicle');
  const notes   = g('bNotes');
  const date    = g('bDate');
  const timeEl  = document.querySelector('.tslot.selected');
  const time    = timeEl ? timeEl.dataset.time : 'Not specified';

  if (!name || !phone || !service || !from) {
    showToast('Please fill in your name, phone, service type and pickup location.', 'error');
    return;
  }

  const btn = document.querySelector('.form-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  const bookingSent = await sendLead('booking', {
    name, phone, service, from, to, vehicle, date, time, notes
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Send Booking Request →'; }

  if (!bookingSent) {
    showToast("Sorry, that didn't send. Please call 07865 449983 directly and Kris will take your booking.", 'error');
    return;
  }

  const modal = document.getElementById('bookingModal');
  if (modal) modal.classList.add('open');

  pushDataLayerEvent('callback_submit_success', { page_path: window.location.pathname, form_location: 'booking_form' });

  ['bName','bPhone','bEmail','bFrom','bTo','bVehicle','bNotes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const srv = document.getElementById('bService'); if (srv) srv.value = '';
  const hid = document.getElementById('bDate');    if (hid) hid.value = '';
  selDate = null;
  document.querySelectorAll('.tslot').forEach(s => s.classList.remove('selected'));
  const ts = document.getElementById('timeSlotSection'); if (ts) ts.style.display = 'none';
  if (document.getElementById('calContainer')) renderCalendar('calContainer');
}

// ── CONTACT SUBMIT ──
async function submitContact() {
  const g = id => (document.getElementById(id)||{}).value?.trim()||'';
  const name    = g('cName');
  const phone   = g('cPhone');
  const subject = g('cSubject');
  const message = g('cMsg');

  if (!name || !phone || !message) {
    showToast('Please fill in your name, phone and message.', 'error');
    return;
  }

  const btn = document.querySelector('.form-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  const contactSent = await sendLead('contact', { name, phone, subject, message });

  if (btn) { btn.disabled = false; btn.textContent = 'Send Message →'; }

  if (!contactSent) {
    showToast("Sorry, that didn't send. Please call 07865 449983 directly.", 'error');
    return;
  }

  const modal = document.getElementById('contactModal');
  if (modal) modal.classList.add('open');

  ['cName','cPhone','cMsg'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

// ── MODAL CLOSE ──
function closeModal(id) {
  const m = document.getElementById(id); if (m) m.classList.remove('open');
}
document.addEventListener('click', function(e) {
  if (e.target && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── TOAST ──
function showToast(msg, type) {
  let t = document.getElementById('siteToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'siteToast';
    t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:8px;font-size:0.9rem;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.4s;max-width:90vw;text-align:center;color:#fff;';
    document.body.appendChild(t);
  }
  t.style.background = type === 'error' ? '#c53030' : '#0d1b2a';
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 4000);
}

// ── ESCAPE HTML ──
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── ACTIVE NAV LINK ──
// Compares against the current extensionless canonical path rather than a
// .html filename, since internal links now point directly at canonical URLs.
document.addEventListener('DOMContentLoaded', function() {
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
    a.classList.remove('active');
    const href = (a.getAttribute('href') || '').replace(/\/+$/, '') || '/';
    if (href === currentPath) {
      a.classList.add('active');
    }
  });
});


/* ══════════════════════════════════════
   FRICTIONLESS LEAD SYSTEM
   Callback drawer + quick forms
   All fire to Telegram instantly
   ══════════════════════════════════════ */

// ── CALLBACK DRAWER ──
function openCallback() {
  document.getElementById('callbackDrawer').classList.add('open');
  document.getElementById('callbackOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  // focus name field
  setTimeout(() => {
    const n = document.getElementById('cbName');
    if (n) n.focus();
  }, 350);
}

function closeCallback() {
  document.getElementById('callbackDrawer').classList.remove('open');
  document.getElementById('callbackOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Close drawer on overlay tap
document.addEventListener('DOMContentLoaded', function() {
  const overlay = document.getElementById('callbackOverlay');
  if (overlay) overlay.addEventListener('click', closeCallback);
});

// ── SUBMIT QUICK CALLBACK (drawer or inline widget) ──
// formId = the container div id, successId = success div id
async function submitCallback(nameId, phoneId, successId, submitBtnId, jobType) {
  const nameEl  = document.getElementById(nameId);
  const phoneEl = document.getElementById(phoneId);
  const btn     = document.getElementById(submitBtnId);

  if (!nameEl || !phoneEl) return;

  const name  = nameEl.value.trim();
  const phone = phoneEl.value.trim();

  if (!name || !phone) {
    showToast('Please enter your name and phone number.', 'error');
    return;
  }

  if (!/^[0-9 +]{10,14}$/.test(phone.replace(/\s/g, ''))) {
    showToast('Please enter a valid UK phone number.', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  const type = jobType || 'callback';

  const callbackSent = await sendLead('callback', { name, phone, jobType: type });

  // Show success
  if (btn) { btn.disabled = false; btn.textContent = 'Request Callback →'; }

  if (!callbackSent) {
    showToast('Sorry, that didn\'t send. Please call 07865 449983 directly.', 'error');
    return;
  }

  const successEl = document.getElementById(successId);
  if (successEl) {
    successEl.classList.add('show');
    var formLocation = successId === 'heroSuccess' ? 'hero_widget' : successId === 'drawerSuccess' ? 'callback_drawer' : successId === 'bkSuccess' ? 'booking_callback_box' : 'callback_form';
    pushDataLayerEvent('callback_submit_success', { page_path: window.location.pathname, form_location: formLocation });
    nameEl.value = '';
    phoneEl.value = '';
  }

  // Auto-close drawer after 2.5s
  if (successId === 'drawerSuccess') {
    setTimeout(closeCallback, 2500);
  }
}

// ── ENTER KEY on callback inputs ──
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  const id = document.activeElement && document.activeElement.id;
  if (id === 'cbName')       document.getElementById('cbPhone').focus();
  else if (id === 'cbPhone') submitCallback('cbName','cbPhone','drawerSuccess','drawerBtn','callback');
  else if (id === 'hwName')  document.getElementById('hwPhone').focus();
  else if (id === 'hwPhone') submitCallback('hwName','hwPhone','heroSuccess','heroBtn','callback');
});
