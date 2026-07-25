/* ═══════════════════════════════════════
   KRIS RECOVERY — main.js
   Flat file structure — no subfolders
   Telegram via direct API (works on
   Cloudflare Pages / any static host)
   ═══════════════════════════════════════ */

const TG_TOKEN   = '8798074297:AAE5Jb9Yx0xrGeHnFYdz1tuE7b9MpLzxVn4';
const TG_CHAT_ID = '7676485257';
const TG_URL     = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;

async function sendTelegram(text) {
  try {
    const res = await fetch(TG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await res.json();
    return data.ok === true;
  } catch (e) {
    console.warn('Telegram send error:', e);
    return false;
  }
}

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

  // Fire to Telegram
  sendTelegram(
    `💬 <b>WEBSITE CHAT</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💬 <b>Message:</b> ${escHtml(text)}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `⚡ Reply: https://wa.me/447865449983`
  );

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

  await sendTelegram(
    `📅 <b>NEW BOOKING REQUEST</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Name:</b> ${escHtml(name)}\n` +
    `📞 <b>Phone:</b> ${escHtml(phone)}\n` +
    `🔧 <b>Service:</b> ${escHtml(service)}\n` +
    `📍 <b>Pickup:</b> ${escHtml(from)}\n` +
    `🏁 <b>Drop-off:</b> ${escHtml(to||'Not specified')}\n` +
    `🚗 <b>Vehicle:</b> ${escHtml(vehicle||'Not specified')}\n` +
    `📆 <b>Date:</b> ${escHtml(date||'Not specified')}\n` +
    `🕐 <b>Time:</b> ${escHtml(time)}\n` +
    `📝 <b>Notes:</b> ${escHtml(notes||'None')}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `⚡ <b>Call back:</b> <a href="tel:${escHtml(phone)}">${escHtml(phone)}</a>`
  );

  if (btn) { btn.disabled = false; btn.textContent = 'Send Booking Request →'; }

  const modal = document.getElementById('bookingModal');
  if (modal) modal.classList.add('open');

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

  await sendTelegram(
    `✉️ <b>CONTACT FORM</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Name:</b> ${escHtml(name)}\n` +
    `📞 <b>Phone:</b> ${escHtml(phone)}\n` +
    `📋 <b>Subject:</b> ${escHtml(subject)}\n` +
    `💬 <b>Message:</b> ${escHtml(message)}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `⚡ <a href="tel:${escHtml(phone)}">${escHtml(phone)}</a>`
  );

  if (btn) { btn.disabled = false; btn.textContent = 'Send Message →'; }

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
document.addEventListener('DOMContentLoaded', function() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
    a.classList.remove('active');
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html') || (page === 'index.html' && href === 'index.html')) {
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
  const label = type === 'prebook' ? '📅 PRE-BOOK REQUEST' : '📞 CALLBACK REQUEST';

  await sendTelegram(
    `${label}
` +
    `━━━━━━━━━━━━━━━━━━
` +
    `👤 <b>Name:</b> ${escHtml(name)}
` +
    `📞 <b>Phone:</b> ${escHtml(phone)}
` +
    `━━━━━━━━━━━━━━━━━━
` +
    `⚡ <a href="tel:${escHtml(phone.replace(/\s/g,''))}">${escHtml(phone)}</a>`
  );

  // Show success
  if (btn) { btn.disabled = false; btn.textContent = 'Request Callback →'; }
  const successEl = document.getElementById(successId);
  if (successEl) {
    successEl.classList.add('show');
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
