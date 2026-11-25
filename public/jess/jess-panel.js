// Jess, the AI hiring assistant panel (handsdown prototype, from handsdown-home-con-chat.html).
//
// Every "Describe your role" button ([data-jess]) and every search box on the page (site/prompts.ts
// dispatches blureffect:open-agent-journey) opens this panel, docked to the right of the page
// (a sheet along the bottom under 1024px). Jess turns what the visitor types into a hiring request.
//
// What lives here (flows and edge cases are written up in docs/jess-conversations.md):
//   - Conversations are saved in localStorage (hd_jess_conversations_v1), one active at a time.
//     Closing the panel or reloading the page never loses one; reopening resumes it.
//   - A hiring request holds one or more requirements, each kept separately (role, specialty,
//     seniority, hours, how many). The "Hiring request" box lists them; each can be edited or removed.
//   - A search box submitted while a conversation already has a request never overwrites or mixes
//     it: Jess asks whether to add it to the request, start a new search, or cancel.
//   - Header: Book a call and Expand stay one tap away; New search, Saved conversations, Clear and
//     Delete live in the ⋯ menu. Clear and Delete ask first, and both can be undone for a few seconds.
//   - "Open full conversation" hands the request to the full-screen chat (jess/widget/); when the
//     visitor comes back from it, the panel reopens where it was.
// data-mode="talent" (apply page): Jess answers applicants' questions only; no request, no booking.
(() => {
  const SELF = document.currentScript;
  window.__hdJess = true;
  const A = 'jess/widget/assets/';
  const VIDEO = { greet: A + 'avatar-greeting-CKvUuCn3.mp4', idle: A + 'avatar-idle-a-DxCPPLKK.mp4', speak: A + 'avatar-speaking-loop-BvjhnHFE.mp4', poster: A + 'poster-ZcDQn2JZ.jpg' };
  const TALENT = !!SELF && SELF.dataset.mode === 'talent';
  const HELLO_T = 'Hi, I’m Jess. Ask me anything about applying to the Handsdown network: who we place, what we need from you, or what happens next.';
  const FAQ_T = [
    ['What happens after I apply?', 'We read your profile against the roles our clients are hiring for. If it fits, we book a 30-minute intro call, then a structured interview. When a role fits, we introduce you to the client with the evidence behind it.'],
    ['Who can apply?', 'Mid-senior and senior engineers, designers and tech specialists based in Latin America, with 3+ years of experience, who want to work with US product teams.'],
    ['Why LinkedIn and GitHub?', 'Next to your CV, they are what our talent team reads first: your track record and your work, faster than any form could show it.'],
  ];
  const WHICH_T = [/after|next|happen|process|hear back|how long|review|interview|call/i, /who|eligib|qualif|experience|years|junior|country|based|where/i, /linkedin|github|why.*(need|ask)|portfolio|cv|resume/i];
  const FALLBACK_T = 'Good question. Our talent team will answer it on your intro call. The quickest way to get there is to finish your application: CV, LinkedIn, GitHub, then your name and email.';
  const HELLO_C = 'Hi, I’m Jess. Tell me the role you’re hiring for and I’ll shape it into a hiring request. Or ask me anything first.';
  const FAQ_C = [
    ['What does vetting look like?', 'Five checks before you meet anyone: a skills screen, a structured interview, a real work sample, team fit and a fairness audit. You get a shortlist, not a pile of CVs.'],
    ['How fast can a team start?', 'It depends on the role. Once the role is defined, you meet a shortlist of people who already said yes to it, and your talent partner gives you a concrete timeline on the first call.'],
    ['What does it cost?', 'Defining the role is free. A full-time senior specialist runs about $7,500–$10,000 a month, against $17,000–$20,500 for the same hire in-house in the US.'],
  ];
  const WHICH_C = [/vet|screen|check|quality/i, /fast|soon|quick|how long|timeline|start/i, /cost|price|pricing|rate|budget|how much/i];
  const HELLO = TALENT ? HELLO_T : HELLO_C;
  const FAQ = TALENT ? FAQ_T : FAQ_C;
  const WHICH = TALENT ? WHICH_T : WHICH_C;
  const STEPS = {
    seniority: { q: 'What seniority do you need?', options: ['Senior', 'Staff', 'Lead / Principal'] },   // all talent is senior or above
    hours: { q: 'And how much overlap with your team’s hours?', options: ['Full US hours', '4+ hours overlap', 'Flexible'] },
  };
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ------------------------------------------------------------------ store */
  // { activeId, convs: { id: { id, created, updated, msgs, items, flow, asked, notes, email, slots, booking, pending } } }
  const KEY = TALENT ? 'hd_jess_talent_v1' : 'hd_jess_conversations_v1';
  const MAX_CONVS = 20;
  let memory = null;                                   // used when localStorage is unavailable (private mode, blocked)
  const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && d.convs && typeof d.convs === 'object') {
        for (const c of Object.values(d.convs)) if (!c || !Array.isArray(c.msgs) || !Array.isArray(c.items) || !c.flow) delete d.convs[c && c.id];
        return d;
      }
    } catch (e) { /* corrupt or blocked: start clean */ }
    return memory || { activeId: null, convs: {} };
  }
  let db = load();
  const sorted = () => Object.values(db.convs).sort((a, b) => b.updated - a.updated);
  const hasContent = (c) => !!c && (c.items.length > 0 || c.msgs.some((m) => m.who === 'u'));
  function save() {
    for (const c of Object.values(db.convs)) if (c.id !== db.activeId && !hasContent(c)) delete db.convs[c.id];   // empty drafts aren't kept
    sorted().slice(MAX_CONVS).forEach((c) => { if (c.id !== db.activeId) delete db.convs[c.id]; });
    memory = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* memory only */ }
  }
  const newConv = () => ({ id: uid('c'), created: Date.now(), updated: Date.now(), msgs: [], items: [], flow: { step: 'role' }, asked: [], notes: [], email: '', slots: null, booking: null, pending: null });
  function conv() {
    let c = db.convs[db.activeId];
    if (!c) { c = newConv(); db.convs[c.id] = c; db.activeId = c.id; }
    return c;
  }
  const touch = (c) => { c.updated = Date.now(); save(); };

  /* --------------------------------------------------------- understanding */
  const SPEC = [
    ['fullstack', /full[\s-]?stack/i], ['ml', /\bml\b|machine learning|\bai\b|\bllm|mlops|data scien/i],
    ['mobile', /mobile|\bios\b|android|react native|flutter|swift|kotlin/i], ['frontend', /front[\s-]?end|react|vue|angular|next\.?js|svelte|ui engineer/i],
    ['backend', /back[\s-]?end|node|\bjava\b|python|golang|\bgo\b|ruby|rails|django|\.net|c#|php|\bapi/i],
    ['devops', /devops|\bsre\b|cloud|infra|platform eng|kubernetes|\baws\b|\bgcp\b|azure/i], ['data', /\bdata\b|analytics|\betl\b|\bbi\b|warehouse/i],
    ['qa', /\bqa\b|quality|\btest|sdet/i], ['design', /design|\bux\b|\bui\b|figma/i], ['product', /product manager|\bpm\b|product owner/i],
  ];
  const specOf = (t) => (SPEC.find(([, r]) => r.test(t)) || ['other'])[0];
  const NOUN = /(developer|engineer|designer|manager|architect|lead|analyst|scientist|specialist|owner|tester|squad|team|consultant|administrator|devs?)\b/i;
  const NUM = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2 };
  const SMALL = /^(and|or|of|for|with|in|on|to|the|a|an|&)$/i;
  const title = (s) => s.split(/\s+/).map((w, i) => (i && SMALL.test(w) ? w.toLowerCase() : /^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
  function parse(text) {
    let t = String(text).trim().replace(/\s+/g, ' ')
      .replace(/^(hi|hello|hey)[,!.\s]+/i, '')
      .replace(/^(i[’']?m|we[’']?re|i am|we are)\s+(also\s+)?(looking for|hiring|searching for)\s+/i, '')
      .replace(/^(i|we)\s+(also\s+)?(need|want|would like|are looking for)\s+(to hire\s+)?/i, '')
      .replace(/^(also|plus|and|add|another)\s+/i, '')
      .replace(/^(hire|hiring|find)\s+/i, '');
    let count = 1;
    const m = t.match(/^(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|an?|the)\s+/i);
    if (m) {
      const w = m[1].toLowerCase().replace('a couple of', 'couple');
      count = /^\d+$/.test(w) ? Math.max(1, Math.min(20, +w)) : NUM[w] || 1;
      t = t.slice(m[0].length);
    }
    t = t.replace(/[.!?\s]+$/, '').slice(0, 80);
    if (count > 1) t = t.replace(/\b(\w+?)(s)\b(?!.*\b\w+s\b)/i, (all, stem) => (NOUN.test(stem) ? stem : all)); // "2 backend developers" -> developer
    const spec = specOf(t);
    if (t && !NOUN.test(t)) t += spec === 'design' ? ' designer' : spec === 'product' ? ' manager' : /devops|data|qa|ml/.test(spec) ? ' engineer' : spec === 'other' ? '' : ' developer';
    const sen = t.match(/\b(senior|sr\.?|staff|lead|principal)\b/i);
    return { role: title(t || 'Role to define'), spec, count, seniority: sen && !/^lead$/i.test(t) ? pickOption(sen[1], 'seniority') : '' };
  }
  const art = (w) => (/^[aeiou]/i.test(w) && !/^(uni|eu|one)/i.test(w) ? 'an' : 'a');
  const label = (it) => `${it.count > 1 ? it.count + ' × ' : ''}${it.role}`;
  const withArt = (it) => (it.count > 1 ? label(it) : `${art(it.role)} ${it.role}`);
  const listText = (items) => (items.length < 3 ? items.map(label).join(' and ') : `${items.slice(0, -1).map(label).join(', ')} and ${label(items[items.length - 1])}`);
  const detail = (it) => [it.seniority, it.hours].filter(Boolean).join(' · ');
  const complete = (it) => !!(it.seniority && it.hours);
  const firstIncomplete = (c) => c.items.find((i) => !complete(i));
  function pickOption(text, key) {
    const t = text.toLowerCase();
    if (key === 'seniority') { if (/lead|principal/.test(t)) return 'Lead / Principal'; if (/staff/.test(t)) return 'Staff'; if (/senior|sr\b/.test(t)) return 'Senior'; }
    if (key === 'hours') { if (/full|us hours|same hours/.test(t)) return 'Full US hours'; if (/\d|overlap|partial|some/.test(t)) return '4+ hours overlap'; if (/flex|any|async|doesn/.test(t)) return 'Flexible'; }
    return title(text.slice(0, 40));
  }
  function convTitle(c) {
    if (c.items.length) return c.items.length > 1 ? `${c.items[0].role} + ${c.items.length - 1} more` : label(c.items[0]);
    const u = c.msgs.find((m) => m.who === 'u');
    return u ? (u.t.length > 40 ? u.t.slice(0, 38) + '…' : u.t) : 'New conversation';
  }
  function convStatus(c) {
    if (c.booking) return 'Call booked';
    if (!c.items.length) return 'Questions only';
    return firstIncomplete(c) ? 'In progress' : 'Request ready';
  }
  const requestText = (c) => c.items.length
    ? `Hiring request: ${c.items.map((i) => `${label(i)}${detail(i) ? ` (${detail(i)})` : ''}`).join('; ')}.${c.notes.length ? ` Notes: ${c.notes.join('; ')}.` : ''}`
    : '';
  function ago(t) {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function makeSlots() {
    const out = [], d = new Date(), hours = [[11, '11:00 AM'], [14, '2:00 PM'], [10, '10:00 AM']];
    // weekdays only, skipping US holidays that fall in the window (New Year, July 4, Thanksgiving, Christmas)
    const holiday = (x) => { const m = x.getMonth(), day = x.getDate(); return (m === 0 && day === 1) || (m === 6 && day === 4) || (m === 11 && day === 25) || (m === 10 && x.getDay() === 4 && day >= 22 && day <= 28); };
    while (out.length < 3) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6 || holiday(d)) continue;
      const [h, hl] = hours[out.length];
      const at = new Date(d); at.setHours(h, 0, 0, 0);
      out.push({ id: uid('s'), at: at.getTime(), label: `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${hl} ET` });
    }
    return out;
  }
  const slotsOf = (c) => { if (!c.slots || c.slots.some((s) => s.at < Date.now())) c.slots = makeSlots(); return c.slots; };

  /* ------------------------------------------------------------------- css */
  const css = `
  .hd-jp { position: fixed; z-index: 2147482500; top: 0; right: 0; bottom: 0; width: var(--jw, 380px); box-sizing: border-box; display: flex; flex-direction: column;
    padding: 14px 18px 16px; background: var(--color-background-raised, #fff); color: #0f172a; font-size: 14px; line-height: 1.5; box-shadow: -1px 0 0 rgb(2 6 23 / .08);
    visibility: hidden; translate: 100% 0; transition: translate .36s cubic-bezier(.4, 0, .2, 1), width .36s cubic-bezier(.4, 0, .2, 1), visibility 0s linear .36s; }
  .hd-jp.on { visibility: visible; translate: 0 0; transition: translate .36s cubic-bezier(.4, 0, .2, 1), width .36s cubic-bezier(.4, 0, .2, 1); }
  .hd-jp *, .hd-jp *::before, .hd-jp *::after { box-sizing: border-box; }
  .hd-jp button { font: inherit; color: inherit; }
  .hd-jp a { text-decoration: none; }
  .hd-jp h3, .hd-jp h4, .hd-jp p, .hd-jp ul { letter-spacing: normal; }
  .hd-jp button:focus-visible, .hd-jp a:focus-visible, .hd-jp input:focus-visible, .hd-jp select:focus-visible { outline: 2px solid #6e7bff; outline-offset: 2px; }
  /* top bar: the two actions people reach for (book, expand) stay visible; the rest is in the menu */
  .hd-jp-bar { display: flex; align-items: center; gap: 4px; flex: none; }
  .hd-jp-bar .sp { flex: 1; }
  .hd-jp-book { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px 0 12px; border-radius: 999px; border: 1px solid #1e293b; background: #0f172a; color: #fff !important; font-size: 13px !important; font-weight: 500; cursor: pointer; transition: background-color .2s; }
  .hd-jp-book:hover { background: #1e293b; }
  .hd-jp-book.done { background: #ecfdf5; border-color: #a7f3d0; color: #047857 !important; }
  .hd-jp-ic { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; color: #475569 !important; cursor: pointer; }
  .hd-jp-ic:hover, .hd-jp-ic[aria-expanded="true"] { background: rgb(15 23 42 / .06); color: #0f172a !important; }
  .hd-jp-menuwrap { position: relative; }
  .hd-jp-menu { position: absolute; z-index: 3; top: 40px; right: 0; width: 236px; padding: 6px; border-radius: 14px; background: #fff; box-shadow: 0 18px 40px -16px rgb(20 16 60 / .35), 0 0 0 1px rgb(15 23 42 / .08); }
  .hd-jp-menu[hidden] { display: none; }
  .hd-jp-menu button { display: flex; align-items: center; justify-content: space-between; width: 100%; height: 36px; padding: 0 10px; border: 0; border-radius: 9px; background: none; font-size: 13.5px; text-align: left; cursor: pointer; }
  .hd-jp-menu button:hover:not([disabled]), .hd-jp-menu button:focus-visible { background: #f4f3f8; outline: 0; }
  .hd-jp-menu button[disabled] { color: #94a3b8; cursor: default; }
  .hd-jp-menu button small { color: #94a3b8; font-size: 12px; }
  .hd-jp-menu .danger { color: #b42318; }
  .hd-jp-menu hr { margin: 5px 4px; border: 0; border-top: 1px solid rgb(15 23 42 / .08); }
  /* Jess herself */
  .hd-jp-head { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex: none; isolation: isolate; }
  .hd-jp-face { position: relative; flex: none; width: 72px; height: 72px; border-radius: 20px; background: #e9e7f2 center / cover no-repeat; box-shadow: 0 0 0 1px rgb(15 23 42 / .06); transition: width .3s, height .3s; }
  .hd-jp-face video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; border-radius: inherit; transition: opacity .35s ease; }
  .hd-jp-face video.speak, .hd-jp-face video.greet { opacity: 0; }
  .hd-jp.talking .hd-jp-face video.speak { opacity: 1; }
  .hd-jp.greeting .hd-jp-face video.greet { opacity: 1; }
  .hd-jp.greeting .hd-jp-face video.speak { opacity: 0; }
  .hd-jp.greeting .hd-jp-face { animation: hd-jp-pop .7s cubic-bezier(.2,.9,.25,1.15) both; }
  @keyframes hd-jp-pop { from { scale: .78; opacity: 0; } to { scale: 1; opacity: 1; } }
  .hd-jp-face::before { content: ""; position: absolute; inset: -6px; z-index: -1; border-radius: 26px; background: conic-gradient(from 210deg, #4F85E8, #9879D5, #6E7BFF, #4F85E8); opacity: 0; filter: blur(8px); transition: opacity .4s ease; }
  .hd-jp.talking .hd-jp-face::before, .hd-jp.greeting .hd-jp-face::before { opacity: .55; }
  .hd-jp-face::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px rgb(110 123 255 / 0); transition: box-shadow .3s ease; }
  .hd-jp.talking .hd-jp-face::after { box-shadow: inset 0 0 0 2px rgb(110 123 255 / .85); }
  .hd-jp-who { flex: 1; min-width: 0; }
  .hd-jp-who b { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; letter-spacing: -.01em; line-height: 1.2; }
  .hd-jp-who b span { height: 18px; padding: 0 7px; border-radius: 999px; background: rgb(94 106 210 / .1); color: #5e6ad2; font-size: 10.5px; font-weight: 600; line-height: 18px; letter-spacing: .02em; }
  .hd-jp-who small { display: flex; align-items: center; gap: 6px; margin-top: 3px; color: #64748b; font-size: 12.5px; }
  .hd-jp.talking .hd-jp-status { color: #5e6ad2; }
  .hd-jp-bars { display: inline-flex; align-items: center; gap: 2px; height: 10px; }
  .hd-jp-bars i { width: 2px; height: 3px; border-radius: 1px; background: #94a3b8; }
  .hd-jp.talking .hd-jp-bars i { background: #6e7bff; animation: hd-jp-bar .7s ease-in-out infinite; }
  .hd-jp.talking .hd-jp-bars i:nth-child(2) { animation-delay: .12s; } .hd-jp.talking .hd-jp-bars i:nth-child(3) { animation-delay: .24s; }
  @keyframes hd-jp-bar { 0%, 100% { height: 3px; } 50% { height: 10px; } }
  /* the conversation: request box, thread, quick replies, input */
  .hd-jp-main { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto;
    grid-template-areas: "req" "log" "chips" "form" "foot"; margin-top: 12px; }
  .hd-jp-req { grid-area: req; margin-bottom: 10px; border-radius: 14px; background: #f8f7fc; box-shadow: inset 0 0 0 1px rgb(110 123 255 / .22); }
  .hd-jp-req[hidden] { display: none; }
  .hd-jp-req-h { display: flex; align-items: center; gap: 8px; width: 100%; height: 40px; padding: 0 12px; border: 0; background: none; cursor: pointer; text-align: left; }
  .hd-jp-req-h b { font-size: 13px; font-weight: 600; }
  .hd-jp-req-h small { flex: 1; color: #64748b; font-size: 12px; }
  .hd-jp-req-h svg { transition: rotate .2s; color: #64748b; }
  .hd-jp-req.open .hd-jp-req-h svg { rotate: 180deg; }
  .hd-jp-req-b { display: none; padding: 0 8px 8px; max-height: 38vh; overflow-y: auto; }
  .hd-jp-req.open .hd-jp-req-b { display: grid; gap: 6px; }
  .hd-jp-it { padding: 9px 10px; border-radius: 10px; background: #fff; box-shadow: 0 0 0 1px rgb(15 23 42 / .06); }
  .hd-jp-it .r { display: flex; align-items: flex-start; gap: 8px; }
  .hd-jp-it .t { flex: 1; min-width: 0; }
  .hd-jp-it .t b { display: block; font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
  .hd-jp-it .t small { display: block; color: #64748b; font-size: 12px; }
  .hd-jp-it .t small.miss { color: #b45309; }
  .hd-jp-it .a { display: flex; gap: 2px; flex: none; }
  .hd-jp-lnk { height: 26px; padding: 0 8px; border: 0; border-radius: 7px; background: none; color: #5e6ad2 !important; font-size: 12.5px !important; font-weight: 600; cursor: pointer; }
  .hd-jp-lnk:hover { background: rgb(94 106 210 / .08); }
  .hd-jp-lnk.danger { color: #b42318 !important; } .hd-jp-lnk.danger:hover { background: rgb(180 35 24 / .07); }
  .hd-jp-lnk.solid { background: #0f172a; color: #fff !important; } .hd-jp-lnk.solid.danger { background: #b42318; color: #fff !important; }
  .hd-jp-it .ask { margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgb(15 23 42 / .12); display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #334155; }
  .hd-jp-it .ask span { flex: 1; }
  .hd-jp-ed { display: grid; gap: 8px; }
  .hd-jp-ed label { display: grid; gap: 3px; color: #64748b; font-size: 11.5px; }
  .hd-jp-ed input, .hd-jp-ed select { height: 34px; padding: 0 10px; border: 0; border-radius: 8px; background: #fff; box-shadow: inset 0 0 0 1px rgb(15 23 42 / .14); color: #0f172a; font: inherit; font-size: 13.5px; }
  .hd-jp-ed .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .hd-jp-ed .cnt { display: flex; align-items: center; gap: 6px; }
  .hd-jp-ed .cnt button { width: 30px; height: 30px; border: 0; border-radius: 8px; background: #fff; box-shadow: inset 0 0 0 1px rgb(15 23 42 / .14); cursor: pointer; }
  .hd-jp-ed .cnt output { min-width: 22px; text-align: center; color: #0f172a; font-weight: 600; }
  .hd-jp-ed .err { color: #b42318; font-size: 12px; }
  .hd-jp-ed .row { display: flex; justify-content: flex-end; gap: 6px; }
  .hd-jp-add { justify-self: start; }
  .hd-jp-notes { padding: 4px 4px 0; color: #64748b; font-size: 12px; }
  .hd-jp-log { grid-area: log; min-height: 0; overflow-y: auto; display: grid; gap: 8px; align-content: start; overscroll-behavior: contain; padding: 2px 2px 6px; }
  .hd-jp-msg { max-width: 92%; padding: 10px 13px; border-radius: 4px 14px 14px 14px; background: #f4f3f8; color: #1e293b; white-space: pre-line; }
  .hd-jp-msg.me { justify-self: end; border-radius: 14px 4px 14px 14px; background: #0f172a; color: #fff; }
  .hd-jp-msg .src { display: block; margin-bottom: 2px; color: rgb(255 255 255 / .6); font-size: 11px; letter-spacing: .02em; }
  .hd-jp-msg a { display: inline-block; margin-top: 6px; color: #5e6ad2; font-weight: 600; font-size: 13px; cursor: pointer; }
  .hd-jp-msg .opts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .hd-jp-msg .opts button { height: 32px; padding: 0 12px; border-radius: 999px; border: 0; background: #fff; box-shadow: inset 0 0 0 1px rgb(15 23 42 / .14); font-size: 12.5px; font-weight: 500; cursor: pointer; }
  .hd-jp-msg .opts button.primary { background: #0f172a; color: #fff; box-shadow: none; }
  .hd-jp-msg .opts button:hover { box-shadow: inset 0 0 0 1px rgb(94 106 210 / .6); }
  .hd-jp-msg .chosen { display: block; margin-top: 8px; color: #64748b; font-size: 12px; }
  .hd-jp-msg .ex[hidden] { display: none; }
  .hd-jp-note { justify-self: center; max-width: 92%; padding: 2px 10px; color: #64748b; font-size: 12px; text-align: center; }
  .hd-jp-card { padding: 10px 13px 12px; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px rgb(110 123 255 / .3); }
  .hd-jp-card h4 { margin: 0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #94a3b8; font-family: var(--font-mono, ui-monospace, monospace); }
  .hd-jp-card .li { display: grid; gap: 1px; padding: 6px 0; border-bottom: 1px solid rgb(15 23 42 / .06); }
  .hd-jp-card .li:last-of-type { border-bottom: 0; }
  .hd-jp-card .li b { font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
  .hd-jp-card .li small { color: #64748b; font-size: 12px; }
  .hd-jp-card .li small.miss { color: #b45309; }
  .hd-jp-card .go { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 10px; }
  .hd-jp-card .go button { height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid #1e293b; background: #0f172a; color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }
  .hd-jp-card .go a { color: #5e6ad2; font-size: 12.5px; font-weight: 600; cursor: pointer; }
  .hd-jp-card.ok { box-shadow: inset 0 0 0 1px #a7f3d0; background: #f6fefb; }
  .hd-jp-chips { grid-area: chips; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .hd-jp-chips[hidden] { display: none; }
  .hd-jp-chips button { height: 30px; padding: 0 12px; border-radius: 999px; border: 0; background: #fff; box-shadow: inset 0 0 0 1px rgb(15 23 42 / .1); color: #334155; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: box-shadow .2s, color .2s, translate .2s; }
  .hd-jp-chips button:hover { color: #5e6ad2; box-shadow: inset 0 0 0 1px rgb(94 106 210 / .5); translate: 0 -1px; }
  .hd-jp-chips button.quiet { color: #64748b; }
  .hd-jp-form { grid-area: form; display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 5px 5px 5px 16px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 1px rgb(110 123 255 / .35); transition: box-shadow .2s; }
  .hd-jp-form:focus-within { box-shadow: inset 0 0 0 1.5px #6e7bff, 0 0 0 4px rgb(110 123 255 / .14); }
  .hd-jp-form input { flex: 1; min-width: 0; height: 38px; border: 0; outline: 0 !important; background: none; color: #0f172a; font: inherit; font-size: 14.5px; }
  .hd-jp-form input::placeholder { color: #94a3b8; }
  .hd-jp-form button { flex: none; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; border: 1px solid #1e293b; background: #0f172a; color: #fff; cursor: pointer; }
  .hd-jp-foot { grid-area: foot; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; color: #94a3b8; font-size: 12px; }
  .hd-jp-foot button { padding: 2px 0; border: 0; background: none; color: #5e6ad2 !important; font-size: 12.5px; font-weight: 600; cursor: pointer; }
  /* saved conversations: a view over the thread */
  .hd-jp-saved { position: absolute; z-index: 2; inset: 0; display: flex; flex-direction: column; padding: 14px 18px 16px; background: var(--color-background-raised, #fff); }
  .hd-jp-saved[hidden] { display: none; }
  .hd-jp-saved .hd-jp-sh { display: flex; align-items: center; gap: 6px; flex: none; }
  .hd-jp-saved .hd-jp-sh h3 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; }
  .hd-jp-saved ul { flex: 1; min-height: 0; overflow-y: auto; margin: 12px 0; padding: 0; list-style: none; display: grid; gap: 6px; align-content: start; }
  .hd-jp-saved li { display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 0; border-radius: 12px; box-shadow: inset 0 0 0 1px rgb(15 23 42 / .08); }
  .hd-jp-saved li.cur { box-shadow: inset 0 0 0 1.5px rgb(110 123 255 / .55); }
  .hd-jp-saved li > button:first-child { flex: 1; min-width: 0; display: grid; gap: 2px; padding: 9px 12px; border: 0; background: none; text-align: left; cursor: pointer; border-radius: 12px; }
  .hd-jp-saved li > button:first-child:hover { background: #f8f7fc; }
  .hd-jp-saved li b { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hd-jp-saved li small { color: #64748b; font-size: 12px; }
  .hd-jp-saved li em { font-style: normal; color: #5e6ad2; font-weight: 600; }
  .hd-jp-saved .empty { padding: 24px 4px; color: #64748b; text-align: center; }
  .hd-jp-saved .hd-jp-sf { flex: none; display: flex; justify-content: center; }
  /* confirmation sheet and undo toast */
  .hd-jp-sheet { position: absolute; z-index: 4; inset: 0; display: grid; align-items: end; padding: 12px; background: rgb(15 23 42 / .28); }
  .hd-jp-sheet[hidden] { display: none; }
  .hd-jp-sheet > div { padding: 18px; border-radius: 18px; background: #fff; box-shadow: 0 30px 60px -20px rgb(20 16 60 / .45); }
  .hd-jp-sheet h3 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
  .hd-jp-sheet p { margin: 0; color: #475569; font-size: 13.5px; }
  .hd-jp-sheet .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  .hd-jp-sheet .row button { height: 36px; padding: 0 16px; border-radius: 999px; border: 0; background: #f1f5f9; font-size: 13.5px; font-weight: 500; cursor: pointer; }
  .hd-jp-sheet .row button.go { background: #0f172a; color: #fff; }
  .hd-jp-sheet .row button.go.danger { background: #b42318; }
  .hd-jp-toast { position: absolute; z-index: 5; left: 18px; right: 18px; bottom: 74px; display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 14px; border-radius: 12px; background: #0f172a; color: #fff; font-size: 13px; box-shadow: 0 16px 30px -14px rgb(15 23 42 / .6); }
  .hd-jp-toast[hidden] { display: none; }
  .hd-jp-toast span { flex: 1; }
  .hd-jp-toast button { height: 28px; padding: 0 10px; border: 0; border-radius: 8px; background: rgb(255 255 255 / .12); color: #fff !important; font-size: 12.5px; font-weight: 600; cursor: pointer; }
  /* expanded: a wider workspace, the request in its own column */
  .hd-jp.big .hd-jp-main { grid-template-columns: minmax(0, 1fr) 270px; grid-template-rows: minmax(0, 1fr) auto auto auto; column-gap: 18px;
    grid-template-areas: "log req" "chips req" "form req" "foot req"; }
  .hd-jp.big .hd-jp-req { align-self: start; margin: 0; max-height: 100%; overflow-y: auto; }
  .hd-jp.big .hd-jp-req .hd-jp-req-b { display: grid; gap: 6px; max-height: none; }
  .hd-jp.big .hd-jp-req-h svg { display: none; }
  .hd-jp.big .hd-jp-face { width: 84px; height: 84px; }
  html:not(.hd-jess-narrow) .hd-jp.big { box-shadow: -1px 0 0 rgb(2 6 23 / .08), -40px 0 80px -40px rgb(20 16 60 / .35); }
  html.hd-jess-open .hd-fw-wrap { opacity: 0 !important; pointer-events: none !important; }
  html.hd-jess-open iframe[title="Handsdown chat"] { visibility: hidden !important; }
  /* no room beside the page (window under 1024px): a sheet along the bottom; expanded, it takes the screen */
  html.hd-jess-narrow .hd-jp { top: auto; left: 0; width: auto; height: var(--jh, min(62dvh, 520px)); padding: 12px 14px 12px; border-radius: 22px 22px 0 0;
    box-shadow: 0 -1px 0 rgb(2 6 23 / .08), 0 -24px 50px -34px rgb(20 16 60 / .5); translate: 0 100%; transition: translate .36s cubic-bezier(.4, 0, .2, 1), height .36s cubic-bezier(.4, 0, .2, 1), visibility 0s linear .36s; }
  html.hd-jess-narrow .hd-jp.on { translate: 0 0; transition: translate .36s cubic-bezier(.4, 0, .2, 1), height .36s cubic-bezier(.4, 0, .2, 1); }
  html.hd-jess-narrow .hd-jp.big { height: 100dvh; border-radius: 0; }
  html.hd-jess-narrow .hd-jp.big .hd-jp-main { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto; grid-template-areas: "req" "log" "chips" "form" "foot"; }
  html.hd-jess-narrow .hd-jp.big .hd-jp-req { margin-bottom: 10px; max-height: 34dvh; }
  html.hd-jess-narrow .hd-jp-face { width: 52px; height: 52px; border-radius: 16px; }
  html.hd-jess-narrow .hd-jp-head { margin-top: 4px; }
  html.hd-jess-narrow.hd-jess-open body { padding-bottom: min(62dvh, 520px); }
  html.hd-jess-narrow body { transition: padding-bottom .36s cubic-bezier(.4, 0, .2, 1); }
  body { transition: margin-right .36s cubic-bezier(.4, 0, .2, 1); }
  html.hd-jess-open:not(.hd-jess-narrow) body { margin-right: var(--hd-jw, 380px); }
  .hd-jp.talent .hd-jp-book, .hd-jp.talent [data-act="new"], .hd-jp.talent [data-act="saved"], .hd-jp.talent [data-act="delete"], .hd-jp.talent .hd-jp-menu hr { display: none; }
  @media (prefers-reduced-motion: reduce) { body { transition: none; } .hd-jp, .hd-jp-face video { transition: none !important; } .hd-jp.talking .hd-jp-bars i { animation: none; height: 8px; } }`;
  const style = document.createElement('style');
  style.textContent = css + (TALENT ? `
  iframe[title="Handsdown chat"] { display: none !important; }
  .hd-jp-foot [data-full] { visibility: hidden; }` : '');
  document.head.appendChild(style);

  /* ------------------------------------------------------------------ view */
  const ICON = {
    cal: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke-linecap="round"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    expand: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"/></svg>',
    collapse: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5 14 2M6.5 9.5 2 14"/></svg>',
    more: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>',
    x: '<svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9"/></svg>',
    chev: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>',
    back: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5h11M6 4.5v-2h4v2M4 4.5l.7 9h6.6l.7-9"/></svg>',
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  let panel, els = {}, anchor = null, rendered = false, handedOff = false;
  let big = false; try { big = sessionStorage.getItem('hd_jess_big') === '1'; } catch (e) { /* */ }
  let reqOpen = null, editing = null, removing = null, view = 'chat';
  const isTrigger = (a) => !!a && a.matches('[data-jess]');
  const inHeader = (a) => !!a && !!a.closest('header');

  function build() {
    panel = document.createElement('div');
    panel.className = 'hd-jp' + (TALENT ? ' talent' : '') + (big ? ' big' : '');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat with Jess, AI hiring assistant');
    panel.innerHTML = `
      <div class="hd-jp-bar">
        <button type="button" class="hd-jp-book" data-act="book">${ICON.cal}<span>Book a call</span></button>
        <span class="sp"></span>
        <button type="button" class="hd-jp-ic" data-act="expand" aria-pressed="false" aria-label="Expand" title="Expand">${ICON.expand}</button>
        <div class="hd-jp-menuwrap">
          <button type="button" class="hd-jp-ic" data-act="menu" aria-haspopup="menu" aria-expanded="false" aria-label="More options" title="More options">${ICON.more}</button>
          <div class="hd-jp-menu" role="menu" hidden>
            <button type="button" role="menuitem" data-act="new">New search</button>
            <button type="button" role="menuitem" data-act="saved">Saved conversations <small></small></button>
            <hr>
            <button type="button" role="menuitem" data-act="clear">Clear conversation</button>
            <button type="button" role="menuitem" data-act="delete" class="danger">Delete conversation</button>
          </div>
        </div>
        <button type="button" class="hd-jp-ic" data-act="close" aria-label="Close" title="Close">${ICON.x}</button>
      </div>
      <div class="hd-jp-head">
        <div class="hd-jp-face" style="background-image:url(${VIDEO.poster})">
          <video class="idle" muted loop playsinline preload="none" poster="${VIDEO.poster}" src="${VIDEO.idle}"></video>
          <video class="speak" muted loop playsinline preload="none" src="${VIDEO.speak}"></video>
          <video class="greet" muted playsinline preload="none" src="${VIDEO.greet}"></video>
        </div>
        <div class="hd-jp-who"><b>Jess <span>AI</span></b><small><span class="hd-jp-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="hd-jp-status">Your talent partner at handsdown</span></small></div>
      </div>
      <div class="hd-jp-main">
        <div class="hd-jp-req" role="region" aria-label="Hiring request" hidden></div>
        <div class="hd-jp-log" aria-live="polite"></div>
        <div class="hd-jp-chips" hidden></div>
        <form class="hd-jp-form" novalidate><input type="text" autocomplete="off" enterkeyhint="send" maxlength="400" aria-label="${TALENT ? 'Ask Jess a question' : 'Message Jess'}">
          <button type="submit" aria-label="Send to Jess"><svg width="11" height="9" viewBox="0 0 10 8" fill="none" aria-hidden="true"><path d="M6 0 5.3.7l2.8 2.8H0v1h8.1L5.3 7.3l.7.7L10 4 6 0Z" fill="currentColor"/></svg></button></form>
        <div class="hd-jp-foot"><button type="button" data-full>Open full conversation →</button><span class="hd-jp-saveinfo">Saved on this device</span></div>
      </div>
      <div class="hd-jp-saved" hidden></div>
      <div class="hd-jp-sheet" hidden></div>
      <div class="hd-jp-toast" role="status" hidden></div>`;
    document.body.appendChild(panel);
    for (const [k, s] of Object.entries({ log: '.hd-jp-log', chips: '.hd-jp-chips', input: 'input', form: 'form', req: '.hd-jp-req', menu: '.hd-jp-menu', menuBtn: '[data-act="menu"]', saved: '.hd-jp-saved', sheet: '.hd-jp-sheet', toast: '.hd-jp-toast', book: '.hd-jp-book', expand: '[data-act="expand"]' })) els[k] = panel.querySelector(s);

    panel.addEventListener('click', onClick);
    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = els.input.value.trim().slice(0, 400);
      if (!text) return els.input.focus();
      els.input.value = ''; hear(text);
    });
    panel.addEventListener('submit', (e) => {       // a role's edit form (re-rendered often, so delegated)
      const f = e.target.closest('[data-edit]');
      if (f) { e.preventDefault(); saveEdit(f.closest('[data-id]').dataset.id, f); }
    });
    panel.addEventListener('keydown', onKey);
    renderExpand();
  }

  function onClick(e) {
    const t = e.target;
    const act = t.closest('[data-act]');
    if (els.menu && !els.menu.hidden && !t.closest('.hd-jp-menuwrap')) closeMenu();
    if (act) {
      const a = act.dataset.act;
      if (a === 'close') return close(true);
      if (a === 'menu') return els.menu.hidden ? openMenu() : closeMenu();
      if (a === 'expand') return setBig(!big);
      if (a === 'book') return bookCall();
      if (act.disabled) return;
      closeMenu();
      if (a === 'new') return newSearch();
      if (a === 'saved') return showSaved();
      if (a === 'clear') return clearConv();
      if (a === 'delete') return deleteConv(db.activeId);
      return;
    }
    if (t.closest('[data-full]')) { e.preventDefault(); return expandToFullChat(); }
    const opt = t.closest('[data-opt]');
    if (opt) return resolve(opt.dataset.opt);
    const chip = t.closest('.hd-jp-chips button');
    if (chip) return onChip(chip.dataset);
    const more = t.closest('[data-more]');
    if (more) { e.preventDefault(); return expandToFullChat(more.dataset.more); }
    if (t.closest('[data-bookcard]')) { e.preventDefault(); return bookCall(); }
    if (t.closest('[data-editreq]')) { e.preventDefault(); reqOpen = true; renderReq(); return els.req.querySelector('.hd-jp-req-h').focus(); }
    if (t.closest('[data-resched]')) { e.preventDefault(); return reschedule(); }
    const r = t.closest('[data-req]');
    if (r) return onReq(r.dataset.req, r.closest('[data-id]') && r.closest('[data-id]').dataset.id, r);
    const s = t.closest('[data-sv]');
    if (s) return onSaved(s.dataset.sv, s.dataset.id);
  }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (!els.sheet.hidden) return sheetDone(false);
    if (!els.menu.hidden) { closeMenu(); return els.menuBtn.focus(); }
    if (editing || removing) { editing = removing = null; return renderReq(); }
    if (view === 'saved') return showChat();
    close(true);
  }

  /* ---- menu */
  function openMenu() {
    const c = conv(), n = sorted().filter(hasContent).length;
    els.menu.querySelector('[data-act="saved"] small').textContent = n ? String(n) : '';
    els.menu.querySelector('[data-act="clear"]').disabled = !c.msgs.length;
    els.menu.querySelector('[data-act="delete"]').disabled = !hasContent(c);
    els.menu.hidden = false; els.menuBtn.setAttribute('aria-expanded', 'true');
    const first = els.menu.querySelector('button:not([disabled])'); if (first) first.focus();
  }
  function closeMenu() { if (!els.menu || els.menu.hidden) return; els.menu.hidden = true; els.menuBtn.setAttribute('aria-expanded', 'false'); }
  document.addEventListener('keydown', (e) => {
    if (!els.menu || els.menu.hidden || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const items = [...els.menu.querySelectorAll('button:not([disabled])')];
    const i = items.indexOf(document.activeElement);
    e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
  });

  /* ---- messages: everything said is stored first, then shown (Jess's lines type out one by one) */
  const J = (t, more) => ({ id: uid('m'), who: 'j', t, ...more });
  const U = (t, more) => ({ id: uid('m'), who: 'u', t, ...more });
  const N = (t) => ({ id: uid('m'), who: 'n', t });
  let queue = [], busy = false, finishNow = null;
  function post(m, c = conv()) {
    if (m.kind === 'brief' || m.kind === 'booked') c.msgs = c.msgs.filter((x) => x.kind !== m.kind || removeEl(x));   // one live card of each kind
    c.msgs.push(m); touch(c);
    if (panel && c.id === db.activeId) { queue.push(m); pump(); }
  }
  const removeEl = (m) => { const el = els.log && els.log.querySelector(`[data-mid="${m.id}"]`); if (el) el.remove(); return false; };
  function flash(t) { if (!panel) return; const el = msgEl(N(t)); els.log.appendChild(el); scroll(); }
  const scroll = () => { els.log.scrollTop = els.log.scrollHeight; };
  function talking(on) {
    panel.classList.toggle('talking', on);
    const s = panel.querySelector('.hd-jp-status'); if (s) s.textContent = on ? 'Typing…' : 'Your talent partner at handsdown';
  }
  function pump() {
    if (busy) return;
    const m = queue.shift();
    if (!m) { talking(false); renderChips(); renderInput(); return; }
    els.chips.hidden = true;
    const el = msgEl(m);
    if (m.who !== 'j' || m.kind || reduced) { els.log.appendChild(el); scroll(); return pump(); }
    busy = true; talking(true);
    const body = el.querySelector('.tx'), extra = el.querySelectorAll('.ex');
    extra.forEach((x) => (x.hidden = true)); body.textContent = ''; els.log.appendChild(el);
    let n = 0;
    const fin = () => { if (finishNow !== fin) return; finishNow = null; body.textContent = m.t; extra.forEach((x) => (x.hidden = false)); busy = false; scroll(); pump(); };
    finishNow = fin;
    const tick = () => { if (finishNow !== fin) return; n = Math.min(m.t.length, n + 3); body.textContent = m.t.slice(0, n); scroll(); if (n < m.t.length) setTimeout(tick, 16); else fin(); };
    setTimeout(tick, 200);
  }
  function msgEl(m) {
    const el = document.createElement('div');
    el.dataset.mid = m.id;
    const c = conv();
    if (m.kind === 'brief') { el.className = 'hd-jp-card'; el.innerHTML = briefHTML(c); return el; }
    if (m.kind === 'booked') { el.className = 'hd-jp-card ok'; el.innerHTML = bookedHTML(c); return el; }
    if (m.who === 'n') { el.className = 'hd-jp-note'; el.textContent = m.t; return el; }
    if (m.who === 'u') {
      el.className = 'hd-jp-msg me';
      el.innerHTML = `${m.src ? `<span class="src">${esc(m.src)}</span>` : ''}<span class="tx"></span>`;
      el.querySelector('.tx').textContent = m.t; return el;
    }
    el.className = 'hd-jp-msg';
    let ex = '';
    if (m.more != null) ex += `<br class="ex"><a href="#" class="ex" data-more="${esc(m.more)}">Keep talking in the full chat →</a>`;
    if (m.opts && !m.done) ex += `<div class="opts ex" role="group" aria-label="Choose an option">${m.opts.map((o) => `<button type="button" data-opt="${esc(o.v)}"${o.primary ? ' class="primary"' : ''}>${esc(o.label)}</button>`).join('')}</div>`;
    if (m.opts && m.done) { const o = m.opts.find((x) => x.v === m.done); ex += `<span class="chosen ex">${m.done === 'replaced' ? 'Replaced by a newer search' : `You chose: ${esc(o ? o.label : m.done)}`}</span>`; }
    el.innerHTML = `<span class="tx"></span>${ex}`;
    el.querySelector('.tx').textContent = m.t;
    return el;
  }
  function refreshMsg(m) { const old = els.log && els.log.querySelector(`[data-mid="${m.id}"]`); if (old) old.replaceWith(msgEl(m)); }
  function refreshCards() { const c = conv(); c.msgs.filter((m) => m.kind).forEach(refreshMsg); }
  function briefHTML(c) {
    if (!c.items.length) return '<h4>Hiring request</h4><div class="li"><small>No roles yet. Tell Jess what you’re hiring for.</small></div>';
    const rows = c.items.map((i) => `<div class="li"><b>${esc(label(i))}</b>${complete(i) ? `<small>${esc(detail(i))}</small>` : `<small class="miss">${esc(detail(i) || 'Seniority and hours to confirm')}</small>`}</div>`).join('');
    return `<h4>Hiring request · ${c.items.length} role${c.items.length > 1 ? 's' : ''}</h4>${rows}
      <div class="go">${c.booking ? '' : '<button type="button" data-bookcard>Book a call →</button>'}<a href="#" data-editreq>Edit request</a><a href="#" data-more="${esc(requestText(c))}">Continue in the full chat</a></div>`;
  }
  function bookedHTML(c) {
    if (!c.booking) return '<h4>Call</h4><div class="li"><small>No call booked.</small></div>';
    return `<h4>Call booked</h4><div class="li"><b>${esc(c.booking.label)}</b><small>${c.booking.custom ? 'Requested time · your talent partner confirms by email' : '30 minutes with a talent partner'} · ${esc(c.email)}</small></div>
      <div class="li"><small>${esc(c.items.length ? listText(c.items) : 'Role to discuss on the call')}</small></div>
      <div class="go"><a href="#" data-resched>Change time</a></div>`;
  }

  /* ---- quick replies and the input follow the conversation's step */
  function chipList(c) {
    if (TALENT) return FAQ.map((f, i) => (c.asked.includes(i) ? null : { q: i, label: f[0] })).filter(Boolean);
    if (c.pending) return [];
    const f = c.flow;
    if (f.queueRole) return [{ x: 'cancel-add', label: 'Cancel', quiet: 1 }];
    if (f.step === 'seniority' || f.step === 'hours') return STEPS[f.step].options.map((o) => ({ pick: o, label: o }));
    if (f.step === 'slot') return [...slotsOf(c).map((s) => ({ slot: s.id, label: s.label })), { x: 'other-time', label: 'Another time', quiet: 1 }, ...(c.booking ? [{ x: 'keep-time', label: 'Keep current time', quiet: 1 }] : [{ x: 'cancel-book', label: 'Not now', quiet: 1 }])];
    if (f.step === 'email') return [{ x: 'cancel-book', label: 'Not now', quiet: 1 }];
    return FAQ.map((q, i) => (c.asked.includes(i) ? null : { q: i, label: q[0] })).filter(Boolean);
  }
  function renderChips() {
    if (!panel || busy) return;
    const list = chipList(conv());
    els.chips.innerHTML = list.map((o) => `<button type="button"${o.quiet ? ' class="quiet"' : ''}${o.q != null ? ` data-q="${o.q}"` : ''}${o.pick ? ` data-pick="${esc(o.pick)}"` : ''}${o.slot ? ` data-slot="${o.slot}"` : ''}${o.x ? ` data-x="${o.x}"` : ''}>${esc(o.label)}</button>`).join('');
    els.chips.hidden = !list.length;
  }
  function renderInput() {
    if (!panel) return;
    const c = conv(), f = c.flow;
    els.input.placeholder = TALENT ? 'Ask Jess a question…'
      : c.pending ? 'Choose an option above…'
        : f.queueRole ? 'Type the role to add…'
          : f.step === 'role' ? 'I’m looking for a…'
            : f.step === 'seniority' || f.step === 'hours' ? 'Or type your answer…'
              : f.step === 'email' ? 'name@company.com'
                : f.step === 'slot' ? 'Or type a day and time…'
                  : 'Add a role or a detail, or ask me something…';
    els.input.setAttribute('inputmode', f.step === 'email' ? 'email' : 'text');
  }
  function renderHeader() {
    if (!panel) return;
    const c = conv();
    els.book.classList.toggle('done', !!c.booking);
    els.book.innerHTML = c.booking ? `${ICON.check}<span>Call booked</span>` : `${ICON.cal}<span>Book a call</span>`;
    els.book.setAttribute('aria-label', c.booking ? `Call booked for ${c.booking.label}. Change it` : 'Book a call with a talent partner');
  }
  function renderExpand() {
    if (!panel) return;
    panel.classList.toggle('big', big);
    els.expand.innerHTML = big ? ICON.collapse : ICON.expand;
    els.expand.setAttribute('aria-pressed', String(big));
    els.expand.setAttribute('aria-label', big ? 'Collapse' : 'Expand');
    els.expand.title = big ? 'Collapse' : 'Expand';
  }
  function renderAll() {
    if (!panel) return;
    queue = []; finishNow = null; busy = false; talking(false);
    editing = removing = null;
    const c = conv();
    els.log.innerHTML = '';
    c.msgs.forEach((m) => els.log.appendChild(msgEl(m)));
    renderReq(); renderChips(); renderInput(); renderHeader(); scroll();
    rendered = true;
  }

  /* ---- the hiring request box: every requirement on its own row, editable and removable */
  function renderReq() {
    if (!panel) return;
    const c = conv(), box = els.req;
    if (TALENT || !c.items.length) { box.hidden = true; box.innerHTML = ''; return; }
    const people = c.items.reduce((s, i) => s + i.count, 0);
    const open = big || (reqOpen == null ? !document.documentElement.classList.contains('hd-jess-narrow') : reqOpen);
    box.hidden = false; box.classList.toggle('open', open);
    const rows = c.items.map((it) => {
      if (editing === it.id) return editHTML(it);
      const ask = removing === it.id ? `<div class="ask"><span>Remove ${esc(label(it))} from this request?</span><button type="button" class="hd-jp-lnk solid danger" data-req="remove-yes">Remove</button><button type="button" class="hd-jp-lnk" data-req="remove-no">Keep</button></div>` : '';
      return `<div class="hd-jp-it" data-id="${it.id}"><div class="r"><div class="t"><b>${esc(label(it))}</b>${complete(it) ? `<small>${esc(detail(it))}</small>` : `<small class="miss">${esc(detail(it) ? detail(it) + ' · ' : '')}${!it.seniority && !it.hours ? 'Seniority and hours to confirm' : !it.seniority ? 'Seniority to confirm' : 'Hours to confirm'}</small>`}</div>
        <div class="a"><button type="button" class="hd-jp-lnk" data-req="edit" aria-label="Edit ${esc(label(it))}">Edit</button><button type="button" class="hd-jp-lnk danger" data-req="remove" aria-label="Remove ${esc(label(it))}">Remove</button></div></div>${ask}</div>`;
    }).join('');
    box.innerHTML = `<button type="button" class="hd-jp-req-h" data-req="toggle" aria-expanded="${open}"><b>Hiring request</b><small>${c.items.length} role${c.items.length > 1 ? 's' : ''} · ${people} ${people > 1 ? 'people' : 'person'}</small>${ICON.chev}</button>
      <div class="hd-jp-req-b">${rows}${c.notes.length ? `<div class="hd-jp-notes">Notes: ${esc(c.notes.join(' · '))} <button type="button" class="hd-jp-lnk" data-req="notes-clear">Clear notes</button></div>` : ''}
      <button type="button" class="hd-jp-lnk hd-jp-add" data-req="add">+ Add a role</button></div>`;
  }
  function editHTML(it) {
    const sel = (key, val) => {
      const opts = STEPS[key].options.includes(val) || !val ? STEPS[key].options : [val, ...STEPS[key].options];
      return `<select name="${key}"><option value="">Not set</option>${opts.map((o) => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    };
    return `<div class="hd-jp-it" data-id="${it.id}"><form class="hd-jp-ed" data-edit novalidate>
      <label>Role<input name="role" maxlength="80" value="${esc(it.role)}" required></label>
      <div class="two"><label>Seniority${sel('seniority', it.seniority)}</label><label>Hours${sel('hours', it.hours)}</label></div>
      <label>How many<span class="cnt"><button type="button" data-req="dec" aria-label="One fewer">−</button><output name="count">${it.count}</output><button type="button" data-req="inc" aria-label="One more">+</button></span></label>
      <span class="err" hidden>Give the role a name.</span>
      <div class="row"><button type="button" class="hd-jp-lnk" data-req="edit-cancel">Cancel</button><button type="submit" class="hd-jp-lnk solid">Save</button></div></form></div>`;
  }
  function onReq(a, id, btn) {
    const c = conv(), it = c.items.find((i) => i.id === id);
    if (a === 'toggle') { reqOpen = !els.req.classList.contains('open'); return renderReq(); }
    if (a === 'add') { editing = removing = null; return addRolePrompt(); }
    if (a === 'notes-clear') { c.notes = []; touch(c); flash('Notes cleared.'); return renderReq(); }
    if (a === 'edit' && it) {
      editing = id; removing = null; renderReq();
      return els.req.querySelector('[data-edit] input').focus();
    }
    if (a === 'edit-cancel') { editing = null; renderReq(); return; }
    if (a === 'inc' || a === 'dec') { const o = btn.closest('form').querySelector('output'); o.value = String(Math.max(1, Math.min(20, (+o.value || 1) + (a === 'inc' ? 1 : -1)))); return; }
    if (a === 'remove' && it) { removing = id; editing = null; renderReq(); const y = els.req.querySelector('[data-req="remove-no"]'); return y && y.focus(); }
    if (a === 'remove-no') { removing = null; return renderReq(); }
    if (a === 'remove-yes' && it) return removeItem(c, it);
  }
  function saveEdit(id, f) {
    const c = conv(), it = c.items.find((i) => i.id === id);
    if (!it) return;
    const F = f.elements, role = F.role.value.trim();
    if (!role) { f.querySelector('.err').hidden = false; return F.role.focus(); }
    const before = JSON.stringify([it.role, it.seniority, it.hours, it.count]);
    it.role = title(role.slice(0, 80)); it.spec = specOf(role);
    it.seniority = F.seniority.value || ''; it.hours = F.hours.value || '';
    it.count = Math.max(1, Math.min(20, +f.querySelector('output').value || 1));
    editing = null;
    if (JSON.stringify([it.role, it.seniority, it.hours, it.count]) !== before) {
      post(N(`Updated: ${label(it)}${detail(it) ? ` · ${detail(it)}` : ''}`), c);
      // the question Jess was asking about this role may have just been answered in the form
      if ((c.flow.step === 'seniority' || c.flow.step === 'hours') && c.flow.target === it.id && it[c.flow.step]) askNext(c);
    }
    touch(c); renderReq(); refreshCards(); renderChips(); renderInput();
  }
  function removeItem(c, it) {
    const i = c.items.indexOf(it), snap = { ...it }, flowSnap = { ...c.flow };
    c.items.splice(i, 1); removing = null;
    post(N(`Removed ${label(it)} from the request.`), c);
    if (c.flow.target === it.id || !c.items.length) {
      if (!c.items.length && !c.flow.queueRole) { c.flow = { step: 'role', after: c.flow.after }; post(J('Your hiring request is empty now. What role are you hiring for?'), c); }
      else askNext(c);
    }
    touch(c); renderReq(); refreshCards(); renderChips(); renderInput();
    toast(`Removed ${label(it)}.`, () => {
      const cc = db.convs[c.id]; if (!cc) return;
      cc.items.splice(Math.min(i, cc.items.length), 0, snap);
      if (cc.items.length === 1 && cc.flow.step === 'role') cc.flow = flowSnap;
      touch(cc); if (cc.id === db.activeId) { renderReq(); refreshCards(); renderChips(); renderInput(); flash(`${label(snap)} is back in the request.`); }
    });
  }

  /* ---- the conversation itself */
  function addRolePrompt() {
    const c = conv();
    if (c.pending) return post(J('First, let’s settle the search above: add it to this request, start a new one, or cancel.'));
    c.flow.queueRole = true; touch(c);
    showChat();
    post(J('Sure. What’s the other role? Type it below and I’ll add it to this request.'));
    els.input.focus({ preventScroll: true });
  }
  function mkItem(p) { return { id: uid('r'), role: p.role, spec: p.spec, count: p.count, seniority: p.seniority || '', hours: '' }; }
  function addRole(c, text, lead) {
    const it = mkItem(parse(text));
    c.items.push(it);
    renderReq();
    const qs = it.seniority ? 'One quick question' : 'Two quick questions';
    askNext(c, lead ? `Got it: ${label(it)}. ${c.items.length === 1 ? `${qs} and I’ll have a first hiring request. ` : 'I’ll keep it separate from the other roles. '}` : '');
  }
  // Jess asks for whatever is missing next: a role's seniority or hours, then (if the visitor asked
  // to book) the call; otherwise she shows the request.
  function askNext(c, lead = '') {
    const it = firstIncomplete(c);
    const multi = c.items.length > 1;
    if (it) {
      c.flow.target = it.id;
      c.flow.step = it.seniority ? 'hours' : 'seniority';
      const q = STEPS[c.flow.step].q;
      const about = multi && !lead.includes(it.role) ? `For the ${it.role}: ${q.charAt(0).toLowerCase()}${q.slice(1)}` : q;
      post(J(lead + about), c);
    } else {
      c.flow.target = null;
      if (!c.items.length) { c.flow.step = 'role'; if (lead) post(J(lead + 'What role are you hiring for?'), c); }
      else if (c.flow.after === 'book') { c.flow.after = null; startBooking(c, lead); }
      else {
        c.flow.step = c.booking ? 'booked' : 'idle';
        post(J(lead + (c.booking ? 'Your request is updated. Your talent partner will see it before the call.' : multi ? 'Here’s your hiring request. Each role stays separate, so you can edit or remove any of them.' : 'Here’s your hiring request so far. Add another role, or book a call when you’re ready.')), c);
        post({ id: uid('m'), who: 'j', kind: 'brief' }, c);
      }
    }
    touch(c); renderReq(); renderHeader();
  }
  function hear(text) {
    const c = conv();
    showChat();
    if (TALENT) {
      post(U(text));
      const i = WHICH.findIndex((r) => r.test(text));
      if (i >= 0 && !c.asked.includes(i)) c.asked.push(i);
      return post(J(i >= 0 ? FAQ[i][1] : FALLBACK_T));
    }
    if (c.pending) {
      const w = text.toLowerCase();
      const v = /^(add|same|yes|both|existing)/.test(w) ? 'add' : /^(new|separate|start)/.test(w) ? 'new' : /^(cancel|no\b|nope|never ?mind)/.test(w) ? 'cancel' : null;
      if (v) { post(U(text)); return resolve(v === 'add' && c.pending.same ? 'more' : v); }
      post(U(text));
      return post(J('Just so I don’t mix things up: should I add it to this request, start a new search, or cancel? The options are in my message above.'));
    }
    const faq = WHICH.findIndex((r) => r.test(text));
    if (faq >= 0 && /\?\s*$|^(what|how|when|why|do|does|can|is|are|who)\b/i.test(text)) {
      post(U(text)); if (!c.asked.includes(faq)) c.asked.push(faq);
      post(J(FAQ[faq][1], { more: FAQ[faq][0] }));
      return reaskIfMidStep(c);
    }
    post(U(text));
    const f = c.flow;
    if (f.queueRole) { f.queueRole = false; return addRole(c, text, true); }
    if (f.step === 'role') return addRole(c, text, true);
    if (f.step === 'seniority' || f.step === 'hours') {
      const it = c.items.find((i) => i.id === f.target) || firstIncomplete(c);
      if (!it) return askNext(c);
      if (specOf(text) !== 'other' && NOUN.test(text)) return incoming(text, 'chat');   // a new role, not an answer
      it[f.step] = pickOption(text, f.step); renderReq();
      return askNext(c);
    }
    if (f.step === 'email') {
      if (!EMAIL.test(text)) return post(J('That doesn’t look like an email address. Could you check it? For example: name@company.com.'));
      c.email = text.slice(0, 120); f.step = 'slot';
      return post(J(`Thanks. The invite goes to ${c.email}. Which time works for a 30-minute call?`));
    }
    if (f.step === 'slot') {
      const s = slotsOf(c).find((x) => x.label.toLowerCase().startsWith(text.toLowerCase().slice(0, 8)));
      return confirmSlot(c, s || { label: title(text.slice(0, 60)), custom: true });
    }
    // idle / booked: another role, or a detail for the request
    if (specOf(text) !== 'other' || NOUN.test(text)) {
      if (/^(also|and|plus|add|another)\b|\b(also|as well|too)\b/i.test(text)) {
        const it = mkItem(parse(text)); c.items.push(it);
        return askNext(c, `Added ${withArt(it)} to this request. `);
      }
      return incoming(text, 'chat');
    }
    c.notes.push(text.slice(0, 160)); touch(c); renderReq();
    post(J('Noted. I added that to your hiring request so your talent partner sees it.'));
  }
  function reaskIfMidStep(c) {
    const f = c.flow;
    if (f.step === 'seniority' || f.step === 'hours') { const it = c.items.find((i) => i.id === f.target); if (it) post(J(`Back to the ${it.role}: ${STEPS[f.step].q.charAt(0).toLowerCase()}${STEPS[f.step].q.slice(1)}`)); }
    else if (f.step === 'email') post(J('Whenever you’re ready: what’s your work email for the invite?'));
  }

  // A search coming in (a search box, a chip under it, or a new role typed mid-conversation) while
  // this conversation already has something in it: Jess never overwrites it or mixes it in silently.
  function incoming(text, src) {
    const c = conv();
    if (!c.items.length && !c.pending && !c.flow.queueRole) {
      if (src !== 'chat') post(U(text, { src: 'From the search box' }));
      return addRole(c, text, true);
    }
    const p = parse(text);
    if (c.pending) {                                     // a newer search replaces the one still waiting
      const old = c.msgs.find((m) => m.id === c.pending.mid);
      if (old) { old.done = 'replaced'; refreshMsg(old); }
      c.pending = null;
    }
    if (src !== 'chat') post(U(text, { src: 'From the search box' }));
    const same = c.items.find((i) => i.role.toLowerCase() === p.role.toLowerCase()) || (p.spec !== 'other' ? c.items.find((i) => i.spec === p.spec) : null);
    const current = c.items.length === 1 ? withArt(c.items[0]) : `a request with ${c.items.length} roles (${listText(c.items)})`;
    let t, opts;
    if (same) {
      const total = same.count + p.count;
      t = `You already have ${withArt(same)} in this request. Do you need another one, or is this a separate search?`;
      opts = [{ v: 'more', label: `Add another (${total} total)`, primary: 1 }];
      if (same.role.toLowerCase() !== p.role.toLowerCase()) opts.push({ v: 'add', label: `Add ${p.role} as its own role` });
      opts.push({ v: 'new', label: 'Start a new search' }, { v: 'cancel', label: 'Cancel' });
    } else {
      const it = { role: p.role, count: p.count };
      t = `I see we’re already discussing ${current}. Are you looking to add ${withArt(it)} to that same hiring request, or would you like to start a separate search?`;
      opts = [{ v: 'add', label: 'Add to existing request', primary: 1 }, { v: 'new', label: 'Start a new search' }, { v: 'cancel', label: 'Cancel' }];
    }
    const m = J(t, { opts });
    c.pending = { text, mid: m.id, parsed: p, same: same ? same.id : null };
    post(m, c);
    renderInput();
  }
  function resolve(v) {
    const c = conv(), p = c.pending;
    if (!p) return;
    const m = c.msgs.find((x) => x.id === p.mid);
    if (m) { m.done = v; refreshMsg(m); }
    c.pending = null; touch(c);
    const wasBooking = c.flow.step === 'email' || c.flow.step === 'slot';
    if (v === 'more') {
      const same = c.items.find((i) => i.id === p.same);
      if (!same) return resolveAdd(c, p, wasBooking);
      same.count = Math.min(20, same.count + p.parsed.count); renderReq(); refreshCards();
      post(N(`${label(same)} in this request`), c);
      if (wasBooking) { reaskIfMidStep(c); return reaskIfBooking(c); }
      return askNext(c, `Done: ${label(same)}. `);
    }
    if (v === 'add') return resolveAdd(c, p, wasBooking);
    if (v === 'new') {
      const prev = convTitle(c);
      const n = newConv(); db.convs[n.id] = n; db.activeId = n.id; save();
      renderAll();
      post(N(`New search started. “${prev}” is saved in Saved conversations.`), n);
      post(U(p.text, { src: 'From the search box' }), n);
      return addRole(n, p.text, true);
    }
    post(J('No problem. Nothing changed in your hiring request.'), c);
    reaskIfMidStep(c); reaskIfBooking(c);
  }
  function resolveAdd(c, p, wasBooking) {
    const it = mkItem(p.parsed); c.items.push(it); renderReq(); refreshCards();
    if (wasBooking) c.flow.after = 'book';
    askNext(c, `Added ${withArt(it)} to your hiring request. `);
  }
  function reaskIfBooking(c) { if (c.flow.step === 'slot') post(J('Which time works for the call?'), c); }

  function onChip(d) {
    const c = conv();
    if (d.q != null) {
      const i = +d.q; post(U(FAQ[i][0])); if (!c.asked.includes(i)) c.asked.push(i);
      post(J(FAQ[i][1], TALENT ? {} : { more: FAQ[i][0] }));
      return TALENT ? null : reaskIfMidStep(c);
    }
    if (d.pick) return hear(d.pick);
    if (d.slot) { const s = slotsOf(c).find((x) => x.id === d.slot); if (s) { post(U(s.label)); confirmSlot(c, s); } return; }
    if (d.x === 'other-time') { post(U('Another time')); return post(J('Tell me a day and time that works (Eastern Time), and your talent partner will confirm it by email.')); }
    if (d.x === 'keep-time') { post(U('Keep current time')); c.flow.step = 'booked'; touch(c); return post(J(`Great, you’re still set for ${c.booking.label}.`)); }
    if (d.x === 'cancel-book') { post(U('Not now')); c.flow.step = c.booking ? 'booked' : c.items.length ? 'idle' : 'role'; c.flow.after = null; touch(c); return post(J('No problem. Your hiring request is saved. Book a call from the top of this panel whenever you’re ready.')); }
    if (d.x === 'cancel-add') { c.flow.queueRole = false; touch(c); post(U('Cancel')); post(J('Okay, nothing added.')); return reaskIfMidStep(c); }
  }

  /* ---- booking: only with a defined role; otherwise Jess collects what's missing first */
  function bookCall() {
    if (TALENT) return;
    const c = conv();
    closeMenu(); showChat();
    if (!isOpen()) open(null);
    if (c.pending) return post(J('First, let’s settle the search above: add it to this request, start a new one, or cancel. Then we’ll book.'));
    if (c.booking) return reschedule();
    c.flow.queueRole = false;
    if (!c.items.length) {
      c.flow = { step: 'role', after: 'book' }; touch(c);
      return post(J('Happy to set up a call. First, what role are you hiring for? Your talent partner will come prepared for it.'));
    }
    const it = firstIncomplete(c);
    if (it) {
      c.flow.after = 'book';
      const need = !it.seniority && !it.hours ? 'two details' : 'one detail';
      return askNext(c, `Happy to set up a call. I just need ${need} on the ${it.role} first. `);
    }
    startBooking(c);
  }
  function startBooking(c, lead = '') {
    if (!c.email) { c.flow.step = 'email'; post(J(lead + 'Let’s book a 30-minute call with your talent partner. What’s your work email? I’ll send the invite there.'), c); }
    else { c.flow.step = 'slot'; post(J(lead + `Let’s book a 30-minute call with your talent partner. Which time works? The invite goes to ${c.email}.`), c); }
    touch(c);
  }
  function reschedule() {
    const c = conv();
    c.flow.step = 'slot'; touch(c);
    post(J(`You’re booked for ${c.booking.label}. Pick a new time below, or keep this one.`));
  }
  function confirmSlot(c, s) {
    c.booking = { label: s.label, at: s.at || null, custom: !!s.custom, made: Date.now() };
    c.flow.step = 'booked'; c.flow.after = null; touch(c);
    post(J(s.custom ? `Thanks. I’ve asked your talent partner for ${s.label}. You’ll get a confirmation at ${c.email}.` : `You’re booked for ${s.label}. The invite is on its way to ${c.email}.`), c);
    post({ id: uid('m'), who: 'j', kind: 'booked' }, c);
    refreshCards(); renderHeader();
    // for the real backend: everything the call needs, in one event
    window.dispatchEvent(new CustomEvent('hd:jess-call-booked', { detail: { conversationId: c.id, email: c.email, slot: c.booking, request: c.items.map(({ role, spec, seniority, hours, count }) => ({ role, specialty: spec, seniority, hours, count })), notes: c.notes } }));
  }

  /* ---- conversation management */
  function newSearch() {
    const c = conv();
    showChat();
    if (!hasContent(c)) { flash('This is already a new search.'); return els.input.focus(); }
    const prev = convTitle(c);
    const n = newConv(); db.convs[n.id] = n; db.activeId = n.id; save();
    renderAll();
    post(N(`New search started. “${prev}” is saved in Saved conversations.`), n);
    post(J(HELLO), n);
    els.input.focus({ preventScroll: true });
  }
  function clearConv() {
    const c = conv();
    if (!c.msgs.length) return;
    const keep = c.items.length ? ` Your hiring request (${listText(c.items)}) stays, so you can keep going.` : '';
    confirm({ title: 'Clear this conversation?', body: `The messages will be removed.${keep}${c.booking ? ' Your booked call stays too.' : ''}`, ok: 'Clear messages' }, () => {
      const snap = JSON.parse(JSON.stringify(c));
      c.msgs = []; c.pending = null; c.asked = []; c.flow.queueRole = false; touch(c);
      renderAll();
      post(N('Messages cleared.'), c);
      resumePrompt(c);
      toast('Conversation cleared.', () => { db.convs[c.id] = snap; touch(snap); if (db.activeId === c.id) { renderAll(); flash('Messages restored.'); } });
    });
  }
  function deleteConv(id) {
    const c = db.convs[id];
    if (!c || !hasContent(c)) return;
    const what = c.items.length ? `This deletes the messages and the hiring request (${listText(c.items)}).` : 'This deletes the messages.';
    confirm({ title: 'Delete this conversation?', body: `${what} Your other saved conversations aren’t affected.${c.booking ? ' The call you booked isn’t cancelled.' : ''}`, ok: 'Delete', danger: true }, () => {
      const snap = JSON.parse(JSON.stringify(c)), wasActive = db.activeId === id;
      delete db.convs[id];
      if (wasActive) { const next = sorted().find(hasContent); db.activeId = next ? next.id : null; }
      save();
      if (view === 'saved') renderSaved();
      if (wasActive) {
        renderAll();
        const n = conv();
        if (!n.msgs.length) post(J(HELLO), n); else flash(`Switched to “${convTitle(n)}”.`);
      }
      toast('Conversation deleted.', () => {
        db.convs[id] = snap; if (wasActive) db.activeId = id; save();
        if (view === 'saved') renderSaved();
        if (wasActive) { renderAll(); flash('Conversation restored.'); }
      });
    });
  }
  // after clearing or resuming: Jess picks the thread back up at the step it was on
  function resumePrompt(c) {
    const f = c.flow;
    if (f.step === 'seniority' || f.step === 'hours') { const it = c.items.find((i) => i.id === f.target); if (it) return post(J(`Let’s pick up where we were. For the ${it.role}: ${STEPS[f.step].q.charAt(0).toLowerCase()}${STEPS[f.step].q.slice(1)}`), c); }
    if (f.step === 'email') return post(J('Let’s pick up where we were: what’s your work email for the call invite?'), c);
    if (f.step === 'slot') return post(J('Let’s pick up where we were: which time works for the call?'), c);
    if (c.items.length) { post(J(c.booking ? `Your hiring request is still here, and your call is set for ${c.booking.label}.` : 'Your hiring request is still here. Add another role, edit it, or book a call when you’re ready.'), c); return post({ id: uid('m'), who: 'j', kind: 'brief' }, c); }
    post(J(HELLO), c);
  }

  /* ---- saved conversations */
  function showSaved() { view = 'saved'; els.saved.hidden = false; renderSaved(); const b = els.saved.querySelector('[data-sv="back"]'); if (b) b.focus(); }
  function showChat() { if (!panel || view === 'chat') return; view = 'chat'; els.saved.hidden = true; }
  function renderSaved() {
    const list = sorted().filter(hasContent);
    els.saved.innerHTML = `<div class="hd-jp-sh"><button type="button" class="hd-jp-ic" data-sv="back" aria-label="Back to the conversation">${ICON.back}</button><h3>Saved conversations</h3><button type="button" class="hd-jp-ic" data-act="close" aria-label="Close">${ICON.x}</button></div>
      ${list.length ? `<ul>${list.map((c) => `<li class="${c.id === db.activeId ? 'cur' : ''}"><button type="button" data-sv="open" data-id="${c.id}"><b>${esc(convTitle(c))}</b><small>${c.id === db.activeId ? '<em>Open now</em> · ' : ''}${esc(convStatus(c))} · ${ago(c.updated)}</small></button><button type="button" class="hd-jp-ic" data-sv="del" data-id="${c.id}" aria-label="Delete ${esc(convTitle(c))}" title="Delete">${ICON.trash}</button></li>`).join('')}</ul>`
        : '<p class="empty">No saved conversations yet. Describe a role to start one.</p>'}
      <div class="hd-jp-sf"><button type="button" class="hd-jp-lnk" data-sv="new">+ New search</button></div>`;
  }
  function onSaved(a, id) {
    if (a === 'back') { showChat(); return els.input.focus({ preventScroll: true }); }
    if (a === 'new') { showChat(); return newSearch(); }
    if (a === 'del') return deleteConv(id);
    if (a === 'open') {
      showChat();
      if (id === db.activeId) return;
      db.activeId = id; save(); renderAll();
      flash('Picking up where you left off.');
    }
  }

  /* ---- confirmation sheet and undo toast */
  let sheetCb = null, sheetReturn = null;
  function confirm(o, ok) {
    sheetCb = ok; sheetReturn = document.activeElement;
    els.sheet.innerHTML = `<div role="alertdialog" aria-modal="true" aria-labelledby="hd-jp-st" aria-describedby="hd-jp-sb"><h3 id="hd-jp-st">${esc(o.title)}</h3><p id="hd-jp-sb">${esc(o.body)}</p>
      <div class="row"><button type="button" data-sheet="no">Cancel</button><button type="button" class="go${o.danger ? ' danger' : ''}" data-sheet="yes">${esc(o.ok)}</button></div></div>`;
    els.sheet.hidden = false;
    els.sheet.querySelector('[data-sheet="no"]').focus();     // the safe choice has focus
    els.sheet.onclick = (e) => { const b = e.target.closest('[data-sheet]'); if (b) sheetDone(b.dataset.sheet === 'yes'); else if (e.target === els.sheet) sheetDone(false); };
    els.sheet.onkeydown = (e) => { if (e.key !== 'Tab') return; const f = [...els.sheet.querySelectorAll('button')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); };
  }
  function sheetDone(yes) {
    const cb = sheetCb; sheetCb = null; els.sheet.hidden = true; els.sheet.innerHTML = '';
    if (yes && cb) cb();
    else if (sheetReturn && document.contains(sheetReturn)) sheetReturn.focus({ preventScroll: true });
    else els.input.focus({ preventScroll: true });
  }
  let toastTimer = 0;
  function toast(text, undo) {
    clearTimeout(toastTimer);
    els.toast.innerHTML = `<span></span>${undo ? '<button type="button">Undo</button>' : ''}`;
    els.toast.querySelector('span').textContent = text;
    els.toast.hidden = false;
    const b = els.toast.querySelector('button');
    if (b) b.onclick = () => { els.toast.hidden = true; clearTimeout(toastTimer); undo(); };
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 8000);
  }

  /* ---- expand and the full-screen chat */
  function setBig(on) {
    big = on; try { sessionStorage.setItem('hd_jess_big', on ? '1' : '0'); } catch (e) { /* */ }
    renderExpand(); renderReq(); place(); scroll();
  }
  // The full experience, exactly as the site opens it: the Smart Match conversation, carrying the request.
  function handOff(text) {
    const detail = { viaJess: true, initialMessage: text, requestId: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `sm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`, presentation: 'immersive' };
    window.__blfxPendingAgentJourney = detail;
    window.dispatchEvent(new CustomEvent('blureffect:open-agent-journey', { detail: { ...detail } }));
  }
  function expandToFullChat(text) {
    const c = conv();
    const msg = text != null && text !== '' ? text : requestText(c);
    close(); handedOff = true; handOff(msg);
  }

  /* ---- docking: a column on the right on desktop, a sheet along the bottom below 1024px */
  const wide = () => window.innerWidth >= 1024;
  // Expanded, the panel widens over the page instead of squeezing it further: the page keeps the normal column's margin.
  const dockWidth = () => Math.round(Math.min(440, Math.max(360, window.innerWidth * 0.3)));
  const panelWidth = () => Math.round(big ? Math.min(860, Math.max(600, window.innerWidth * 0.52)) : dockWidth());
  const mode = () => document.documentElement.classList.toggle('hd-jess-narrow', !wide());
  function room(on) {
    mode();
    const w = dockWidth();
    if (panel) panel.style.setProperty('--jw', panelWidth() + 'px');
    document.documentElement.style.setProperty('--hd-jw', w + 'px');
    const detail = on && wide() ? { view: 'open', docked: true, dockWidth: w, jess: true } : { view: 'closed', jess: true };
    window.dispatchEvent(new CustomEvent('blureffect:agent-view', { detail }));
  }
  function place() { if (isOpen()) room(true); }
  // a: the navbar button it hangs from (for focus and aria-expanded), or null. text: a search
  // typed elsewhere on the page.
  function open(a, text) {
    if (!panel) build();
    anchor = a || anchor || null;
    const c = conv();
    const restored = !rendered && c.msgs.length > 0;
    if (!rendered) renderAll();
    panel.classList.add('on'); document.documentElement.classList.add('hd-jess-open'); room(true);
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    panel.querySelectorAll('video.idle, video.speak').forEach(play);
    if (!c.msgs.length && !reduced) {                    // her greeting clip, the first time
      const g = panel.querySelector('video.greet');
      panel.classList.add('greeting'); g.currentTime = 0; play(g);
      const done = () => panel.classList.remove('greeting');
      g.addEventListener('ended', done, { once: true }); setTimeout(done, 5200);
    }
    if (restored) flash('Picking up where you left off.');
    if (text) { showChat(); incoming(text, 'search'); }
    else if (!c.msgs.length) post(J(HELLO), c);
    if (!matchMedia('(max-width: 639px)').matches) setTimeout(() => els.input.focus({ preventScroll: true }), 120);   // no keyboard pop-up on phones
  }
  function close(refocus) {
    if (!isOpen()) return;
    closeMenu();
    if (!els.sheet.hidden) sheetDone(false);
    panel.classList.remove('on'); document.documentElement.classList.remove('hd-jess-open'); room(false);
    panel.querySelectorAll('video').forEach((v) => v.pause());
    if (anchor) { anchor.setAttribute('aria-expanded', 'false'); if (refocus) anchor.focus({ preventScroll: true }); }
  }
  const isOpen = () => !!panel && panel.classList.contains('on');

  // Every "Describe your role" button (data-jess) toggles the panel and resumes the conversation.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-jess]');
    if (!isTrigger(a)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (isOpen() && inHeader(a)) close(true); else open(inHeader(a) ? a : null);
  }, true);
  // Every other way into the chat (search boxes and their chips) asks the site to open the full
  // conversation. Those requests come to Jess's panel instead, with what the visitor typed. Only the
  // panel's own hand-off goes through.
  window.addEventListener('blureffect:open-agent-journey', (e) => {
    const d = e.detail;
    if (!d || d.viaJess) return;
    e.stopImmediatePropagation();
    delete window.__blfxPendingAgentJourney;
    const text = typeof d.initialMessage === 'string' ? d.initialMessage.trim() : (d.hdProfile && d.hdProfile.role) || '';
    if (isOpen() && !text) return;
    open(isOpen() ? anchor : null, text);
  }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen() && !panel.contains(document.activeElement)) close(true); });
  window.addEventListener('resize', () => { mode(); place(); });
  mode();
  // Another tab changed the saved conversations: show the same state here.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    db = load();
    if (panel) { renderAll(); if (view === 'saved') renderSaved(); }
  });
  // The page asks the chat to step aside at the dark map story (see shim.js): the column obeys too.
  window.addEventListener('blureffect:close-agent-journey', () => close());
  window.addEventListener('blureffect:agent-view', (e) => {
    const d = e.detail;
    if (!d || d.jess) return;
    if (d.view === 'immersive' || d.view === 'panel') close();                    // the full chat took over
    else if (handedOff && (d.view === 'closed' || d.view === 'launcher')) {       // back from it: resume here
      handedOff = false; open(null);
      flash('Back from the full conversation. Your hiring request is still here.');
    }
  });
})();
