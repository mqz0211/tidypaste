/*CORE-START*/
const DEFAULTS = { trackers: true, unwrap: true, join: true, quotes: false, invisible: true, auto: true };

const GLOBAL_PARAMS = new Set([
  'fbclid','gclid','gclsrc','dclid','gbraid','wbraid','msclkid','mc_eid','mc_cid','igshid','igsh','_hsenc','_hsmi',
  'mkt_tok','yclid','twclid','ttclid','li_fat_id','vero_id','vero_conv','oly_enc_id','oly_anon_id','__s','_ga','_gl',
  's_cid','cmpid','spm','scm','trk','trkinfo','trackingid','fb_action_ids','fb_action_types','fb_source','ref_src',
  'rb_clickid','irclickid','ml_subscriber','ml_subscriber_hash','_openstat','wickedid','mibextid','sscid'
]);
const GLOBAL_PREFIX = ['utm_', 'hsa_', 'pk_', 'mtm_', 'stm_'];
const HOST_PARAMS = [
  { host: /(^|\.)(youtube\.com|youtu\.be)$/, keys: ['si', 'feature', 'pp'] },
  { host: /(^|\.)spotify\.com$/, keys: ['si', 'context'] },
  { host: /(^|\.)(twitter\.com|x\.com)$/, keys: ['s', 't', 'ref_url'] },
  { host: /(^|\.)tiktok\.com$/, keys: ['_t', '_r', 'is_from_webapp', 'sender_device', 'sender_web_id', 'share_app_id', 'share_link_id', 'u_code', 'timestamp', 'user_id', 'sec_user_id', 'social_sharing', '_d', 'checksum'] },
  { host: /(^|\.)linkedin\.com$/, keys: ['refid', 'lipi', 'midtoken', 'midsig', 'eid', 'otptoken', 'trkemail', 'originalsubdomain'] },
  { host: /(^|\.)reddit\.com$/, keys: ['share_id', 'rdt_cid', 'correlation_id', 'ref', 'ref_campaign', 'ref_source'] },
  { host: /(^|\.)amazon\.[a-z.]+$/, keys: ['tag', 'linkcode', 'linkid', 'ref', 'ref_', 'qid', 'sr', 'crid', 'sprefix', 'pd_rd_i', 'pd_rd_r', 'pd_rd_w', 'pd_rd_wg', 'pf_rd_i', 'pf_rd_m', 'pf_rd_p', 'pf_rd_r', 'pf_rd_s', 'pf_rd_t', 'content-id', 'psc', 'camp', 'creative', 'creativeasin', 'ascsubtag'] }
];
const REDIRECTS = [
  { test: (h, p) => /^(www\.)?google\.[a-z.]+$/.test(h) && p === '/url', keys: ['q', 'url'] },
  { test: (h, p) => /^(l|lm)\.facebook\.com$/.test(h), keys: ['u'] },
  { test: (h, p) => /^(www\.)?facebook\.com$/.test(h) && p === '/flx/warn', keys: ['u'] },
  { test: (h, p) => h === 'l.instagram.com', keys: ['u'] },
  { test: (h, p) => /(^|\.)youtube\.com$/.test(h) && p === '/redirect', keys: ['q'] },
  { test: (h, p) => /(^|\.)linkedin\.com$/.test(h) && p === '/safety/go', keys: ['url'] },
  { test: (h, p) => h === 'out.reddit.com', keys: ['url'] },
  { test: (h, p) => h === 'duckduckgo.com' && p === '/l', keys: ['uddg'] },
  { test: (h, p) => h === 'steamcommunity.com' && p === '/linkfilter', keys: ['u', 'url'] },
  { test: (h, p) => h === 'vk.com' && p === '/away.php', keys: ['to'] },
  { test: (h, p) => h === 't.umblr.com' && p === '/redirect', keys: ['z'] }
];

function safeDecode(s) { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; } }

function isTracker(key, host) {
  const k = key.toLowerCase();
  if (GLOBAL_PARAMS.has(k)) return true;
  if (GLOBAL_PREFIX.some(p => k.startsWith(p))) return true;
  return HOST_PARAMS.some(hp => hp.host.test(host) && hp.keys.includes(k));
}

function cleanUrl(raw, o) {
  let u;
  try { u = new URL(raw); } catch (e) { return { url: raw, removed: [], unwrapped: 0 }; }
  let unwrapped = 0;
  if (o.unwrap) {
    for (let i = 0; i < 3; i++) {
      const h = u.hostname.toLowerCase();
      const p = u.pathname.replace(/\/+$/, '') || '/';
      const r = REDIRECTS.find(x => x.test(h, p));
      if (!r) break;
      let target = null;
      for (const k of r.keys) {
        const v = u.searchParams.get(k);
        if (v && /^https?:\/\//i.test(v)) { target = v; break; }
      }
      if (!target) break;
      try { u = new URL(target); unwrapped++; } catch (e) { break; }
    }
  }
  const removed = [];
  if (o.trackers) {
    const host = u.hostname.toLowerCase();
    const keep = [];
    for (const part of u.search.slice(1).split('&').filter(Boolean)) {
      const key = safeDecode(part.split('=')[0]);
      if (isTracker(key, host)) removed.push(key); else keep.push(part);
    }
    if (removed.length) u.search = keep.length ? '?' + keep.join('&') : '';
    if (/(^|\.)amazon\.[a-z.]+$/.test(host) && /\/ref=[^/]*/.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\/ref=[^/]*/, '');
      removed.push('/ref=…');
    }
    if (u.hash.startsWith('#:~:text=')) { u.hash = ''; removed.push('text fragment'); }
  }
  const uniq = [...new Set(removed)];
  if (!unwrapped && !uniq.length) return { url: raw, removed: [], unwrapped: 0 };
  let s = u.href;
  if (u.pathname === '/' && !u.search && !u.hash && s.endsWith('/')) s = s.slice(0, -1);
  return { url: s, removed: uniq, unwrapped };
}

function joinLines(text, st) {
  return text.split(/\n[ \t]*\n+/).map(p => {
    const lines = p.split('\n').map(l => l.replace(/[ \t]+$/, ''));
    if (lines.length < 2) return lines.join('');
    const listy = lines.filter(l => /^\s*([-*•▪◦‣●]|\d{1,3}[.)])\s+/.test(l)).length;
    if (listy >= 2) return lines.join('\n');
    if (Math.max(...lines.map(l => l.length)) < 45) return lines.join('\n');
    let out = lines[0];
    for (let i = 1; i < lines.length; i++) {
      const nxt = lines[i].replace(/^\s+/, '');
      if (/[A-Za-z]-$/.test(out) && /^[a-z]/.test(nxt)) { out = out.slice(0, -1) + nxt; st.hyphens++; }
      else if (nxt) { out = out + ' ' + nxt; }
      st.joined++;
    }
    return out;
  }).join('\n\n');
}

function wash(input, o) {
  const st = { invisible: 0, links: [], params: 0, redirects: 0, joined: 0, hyphens: 0, quotes: 0, spaces: 0 };
  let t = input.replace(/\r\n?/g, '\n');
  if (o.invisible) {
    t = t.replace(/[​-‏‪-‮⁠﻿­]/g, () => { st.invisible++; return ''; });
    t = t.replace(/[   ]/g, () => { st.invisible++; return ' '; });
  }
  if (o.trackers || o.unwrap) {
    t = t.replace(/https?:\/\/[^\s<>"]+/gi, m => {
      let url = m, tail = '';
      while (url.length) {
        const c = url[url.length - 1];
        if (/[.,;:!?'”’\]}]/.test(c)) { tail = c + tail; url = url.slice(0, -1); continue; }
        if (c === ')' && url.split(')').length > url.split('(').length) { tail = c + tail; url = url.slice(0, -1); continue; }
        break;
      }
      const r = cleanUrl(url, o);
      if (r.url !== url) {
        let host = '';
        try { host = new URL(r.url).hostname; } catch (e) { host = ''; }
        st.links.push({ host, removed: r.removed, unwrapped: r.unwrapped });
        st.params += r.removed.length;
        st.redirects += r.unwrapped;
      }
      return r.url + tail;
    });
  }
  if (o.join) t = joinLines(t, st);
  t = t.replace(/(\S)[ \t]{2,}(?=\S)/g, (m, a) => { st.spaces++; return a + ' '; });
  t = t.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  if (o.quotes) {
    t = t.replace(/[‘’‛]/g, () => { st.quotes++; return "'"; })
         .replace(/[“”„]/g, () => { st.quotes++; return '"'; })
         .replace(/…/g, () => { st.quotes++; return '...'; });
  }
  return { output: t.trim(), st };
}

function summarize(st) {
  const items = [];
  const add = (n, one, many, warn) => { if (n > 0) items.push({ n, label: n === 1 ? one : many, warn: !!warn }); };
  add(st.params, 'tracking parameter removed', 'tracking parameters removed', true);
  add(st.redirects, 'redirect wrapper unwrapped', 'redirect wrappers unwrapped', true);
  add(st.joined, 'wrapped line joined', 'wrapped lines joined');
  add(st.hyphens, 'split word repaired', 'split words repaired');
  add(st.invisible, 'invisible or odd character fixed', 'invisible or odd characters fixed');
  add(st.spaces, 'extra space run collapsed', 'extra space runs collapsed');
  add(st.quotes, 'curly quote or ellipsis straightened', 'curly quotes or ellipses straightened');
  return items;
}
/*CORE-END*/

(function () {
  const $ = id => document.getElementById(id);
  const inEl = $('in'), outEl = $('out'), statusEl = $('status');
  const OPTION_LABELS = [
    ['trackers', 'Strip tracking parameters'],
    ['unwrap', 'Unwrap redirect links'],
    ['join', 'Fix PDF line breaks'],
    ['invisible', 'Remove invisible characters'],
    ['quotes', 'Straighten quotes'],
    ['auto', 'Copy automatically after paste']
  ];
  const SAMPLE = [
    'Hi team,',
    '',
    'I found the article we talked about on Friday. The authors argue that most produc-',
    'tivity tools fail because they add steps instead of removing them, and that the',
    'best fixes are small ones that save a few seconds thousands of times.',
    '',
    'Article: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.example.com%2Fblog%2Fsmall-fixes%3Futm_source%3Dnewsletter%26utm_medium%3Demail%26fbclid%3DIwAR0abc123&h=AT0xyz',
    'Video: https://youtu.be/abc123XYZ09?si=Zk3pLm9aQ1&feature=shared',
    'Desk: https://www.amazon.com/dp/B08N5WRWNW/ref=sr_1_3?crid=2XYZ&keywords=desk&qid=1700000000&sr=8-3&tag=somesite-20',
    '',
    'Thanks​ for reading,   and  see you Monday.'
  ].join('\n');

  let opts = Object.assign({}, DEFAULTS);
  let stats = { pastes: 0, params: 0, redirects: 0, chars: 0 };
  let history = [];
  let sampleActive = true;

  function load(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ } }
  opts = Object.assign(opts, load('pw:opts', {}));
  stats = Object.assign(stats, load('pw:stats', {}));
  history = load('pw:hist', []);
  if (!Array.isArray(history)) history = [];

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(n) { return Number(n).toLocaleString(); }

  function renderOpts() {
    const box = $('opts'); box.textContent = '';
    OPTION_LABELS.forEach(([key, label]) => {
      const wrap = el('div', 'opt');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = 'opt-' + key; cb.checked = !!opts[key];
      const lb = el('label', null, label); lb.htmlFor = cb.id;
      cb.addEventListener('change', () => { opts[key] = cb.checked; save('pw:opts', opts); run(false); });
      wrap.append(cb, lb); box.append(wrap);
    });
  }

  function renderLife() {
    $('life').innerHTML = '';
    const a = el('div'); a.append(el('b', null, fmt(stats.pastes)), ' pastes cleaned');
    const b = el('div'); b.append(el('b', null, fmt(stats.params + stats.redirects)), ' trackers and wrappers removed');
    const c = el('div'); c.append(el('b', null, fmt(stats.chars)), ' characters cut');
    $('life').append(a, b, c);
  }

  function renderReport(st) {
    const chips = $('chips'), links = $('links');
    chips.textContent = ''; links.textContent = '';
    const items = summarize(st);
    if (!inEl.value.trim()) { chips.append(el('p', 'empty', 'Paste text to see what gets fixed.')); return; }
    if (!items.length) { chips.append(el('p', 'empty', 'Nothing to fix. This text is already clean.')); return; }
    items.forEach(it => {
      const c = el('span', 'chip' + (it.warn ? ' warn' : ''));
      c.append(el('b', null, String(it.n)), ' ' + it.label);
      chips.append(c);
    });
    st.links.forEach(l => {
      const li = el('li');
      li.append(el('span', 'host', l.host || 'link'));
      if (l.unwrapped) li.append(el('span', 'via', 'redirect unwrapped'));
      l.removed.forEach(r => li.append(el('span', 'gone', r)));
      links.append(li);
    });
  }

  function renderHistory() {
    const ul = $('hist'); ul.textContent = '';
    $('histEmpty').hidden = history.length > 0;
    $('clearHist').hidden = history.length === 0;
    history.forEach((h, i) => {
      const li = el('li');
      li.append(el('span', 'when', h.time), el('span', 'txt', h.output.replace(/\s+/g, ' ')));
      if (h.saved > 0) li.append(el('span', 'saved', '−' + fmt(h.saved)));
      const r = el('button', null, 'Restore'); r.type = 'button';
      r.addEventListener('click', () => { sampleActive = false; $('sampleNote').hidden = true; inEl.value = h.input; run(false); flash('Restored'); });
      const c = el('button', null, 'Copy'); c.type = 'button';
      c.addEventListener('click', () => copyText(h.output));
      li.append(r, c); ul.append(li);
    });
  }

  let flashTimer;
  function flash(msg) {
    statusEl.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { statusEl.textContent = ''; }, 3500);
  }

  function copyText(text) {
    const fallback = () => {
      try { outEl.value = text; outEl.focus(); outEl.select(); const ok = document.execCommand('copy'); flash(ok ? 'Copied' : 'Copy blocked. Select the text and press Ctrl+C.'); }
      catch (e) { flash('Copy blocked. Select the text and press Ctrl+C.'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => flash('Copied clean text'), fallback);
    } else fallback();
  }

  let last = null;
  function run(fromPaste) {
    const raw = inEl.value;
    const r = wash(raw, opts);
    last = r;
    outEl.value = r.output;
    renderReport(r.st);
    if (fromPaste && raw.trim()) {
      const saved = raw.length - r.output.length;
      stats.pastes++; stats.params += r.st.params; stats.redirects += r.st.redirects; stats.chars += Math.max(0, saved);
      save('pw:stats', stats); renderLife();
      const d = new Date();
      const time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      if (!history.length || history[0].input !== raw.slice(0, 4000)) {
        history.unshift({ time, input: raw.slice(0, 4000), output: r.output.slice(0, 4000), saved });
        history = history.slice(0, 8); save('pw:hist', history); renderHistory();
      }
      if (opts.auto) copyText(r.output); else flash('Cleaned. Press Copy.');
    }
  }

  inEl.addEventListener('focus', () => { if (sampleActive) inEl.select(); });
  inEl.addEventListener('paste', () => {
    sampleActive = false; $('sampleNote').hidden = true;
    setTimeout(() => run(true), 0);
  });
  inEl.addEventListener('input', () => { if (sampleActive && !inEl.value) { sampleActive = false; $('sampleNote').hidden = true; } run(false); });
  inEl.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); copyText(outEl.value); } });
  $('copy').addEventListener('click', () => copyText(outEl.value));
  $('clearHist').addEventListener('click', () => { history = []; save('pw:hist', history); renderHistory(); });

  try {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
    document.querySelectorAll('.mod').forEach(n => { n.textContent = isMac ? '⌘' : 'Ctrl'; });
  } catch (e) { /* keep Ctrl */ }
  $('navCopy').addEventListener('click', () => copyText(outEl.value));
  $('reset').addEventListener('click', () => { inEl.value = SAMPLE; sampleActive = true; $('sampleNote').hidden = false; run(false); flash('Example loaded'); });
  $('helpBtn').addEventListener('click', () => { const b = $('helpBtn'), open = b.getAttribute('aria-expanded') === 'true'; b.setAttribute('aria-expanded', String(!open)); $('helpBody').hidden = open; });

  inEl.value = SAMPLE;
  renderOpts(); renderLife(); renderHistory(); run(false);
})();
