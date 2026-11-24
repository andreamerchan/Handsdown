// The "Describe your role" conversation (handsdown prototype, from handsdown-home-con-chat.html).
// Clicking any "Describe your role" button ([data-jess]) opens Jess's panel: she introduces
// herself, takes the role and two quick answers, and offers the full conversation (the chat
// widget in jess/widget/, opened full screen through its loader). Prompt fields hand their text
// to her the same way (site/prompts.ts dispatches blureffect:open-agent-journey).
// PROTOTYPE: a compact way into the conversation from the navbar's "Describe your role" button.
// The build sends that click straight to the full-screen chat. Here it opens a small panel under
// the button instead, where Jess (the site's AI agent) introduces herself and the visitor can:
//
//   type a role           -> Jess takes it and asks two quick questions (seniority, hours) with
//                            one-tap answers, then shows the brief so far, all inside the panel
//   tap a common question -> Jess answers right in the panel
//   "Continue with Jess" / "Open full conversation" -> the full chat, carrying the brief
//
// Nothing in the panel opens the full chat by itself: it is offered, and the visitor chooses. Desktop: a popover anchored to the
// button. Phones: a sheet from the bottom. Esc, the close button or a click outside dismisses it.
// Her answers are the short versions of the ones the prototype's scripted agent gives.
(() => {
  const SELF = document.currentScript;
  window.__hdJess = true;
  const A = 'jess/widget/assets/';
  const VIDEO = { greet: A + 'avatar-greeting-CKvUuCn3.mp4', idle: A + 'avatar-idle-a-DxCPPLKK.mp4', speak: A + 'avatar-speaking-loop-BvjhnHFE.mp4', poster: A + 'poster-ZcDQn2JZ.jpg' };
  // data-mode="talent" (apply.html): Jess talks to applicants, not to companies hiring. She answers
  // their questions about applying; nothing turns into a role brief or opens the hiring chat.
  const TALENT = !!SELF && SELF.dataset.mode === 'talent';
  const HELLO_T = 'Hi, I’m Jess. Ask me anything about applying to the Handsdown network: who we place, what we need from you, or what happens next.';
  const FAQ_T = [
    ['What happens after I apply?', 'We read your profile against the roles our clients are hiring for. If it fits, we book a 30-minute intro call, then a structured interview. When a role fits, we introduce you to the client with the evidence behind it.'],
    ['Who can apply?', 'Mid-senior and senior engineers, designers and tech specialists based in Latin America, with 3+ years of experience, who want to work with US product teams.'],
    ['Why LinkedIn and GitHub?', 'Next to your CV, they are what our talent team reads first: your track record and your work, faster than any form could show it.'],
  ];
  const WHICH_T = [/after|next|happen|process|hear back|how long|review|interview|call/i, /who|eligib|qualif|experience|years|junior|country|based|where/i, /linkedin|github|why.*(need|ask)|portfolio|cv|resume/i];
  const FALLBACK_T = 'Good question. Our talent team will answer it on your intro call. The quickest way to get there is to finish your application: CV, LinkedIn, GitHub, then your name and email.';
  const HELLO_C = 'Hi, I’m Jess. Tell me the role you’re hiring for and I’ll shape it into a brief. Or ask me anything first.';
  const FAQ = [
    ['What does vetting look like?', 'Five checks before you meet anyone: a skills screen, a structured interview, a real work sample, team fit and a fairness audit. You get a shortlist, not a pile of CVs.'],
    ['How fast can a team start?', 'It depends on the role. Once your role spec is set, you meet a shortlist of people who already said yes to it, and your talent partner gives you a concrete timeline on the first call.'],
    ['What does it cost?', 'Defining the role is free. A full-time senior specialist runs about $7,500–$10,000 a month, against $17,000–$20,500 for the same hire in-house in the US.'],
  ];
  const HELLO = TALENT ? HELLO_T : HELLO_C;
  if (TALENT) FAQ.splice(0, FAQ.length, ...FAQ_T);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = `
  .hd-jp { position: fixed; z-index: 2147482500; top: 84px; right: 24px; width: 384px; max-width: calc(100vw - 24px); box-sizing: border-box; padding: 16px; border-radius: 16px;
    background: rgb(255 255 255 / .96); -webkit-backdrop-filter: blur(16px) saturate(1.2); backdrop-filter: blur(16px) saturate(1.2);
    box-shadow: 0 30px 70px -28px rgb(20 16 60 / .45), 0 0 0 1px rgb(15 23 42 / .07); color: #0f172a; font-size: 14px; line-height: 1.5;
    opacity: 0; visibility: hidden; translate: 0 -8px; scale: .98; transform-origin: 100% 0; pointer-events: none;
    transition: opacity .2s ease, translate .32s cubic-bezier(.2,.8,.2,1), scale .32s cubic-bezier(.2,.8,.2,1), visibility 0s linear .32s; }
  .hd-jp.on { opacity: 1; visibility: visible; translate: 0 0; scale: 1; pointer-events: auto; transition: opacity .2s ease, translate .32s cubic-bezier(.2,.8,.2,1), scale .32s cubic-bezier(.2,.8,.2,1); }
  .hd-jp-head { display: flex; align-items: center; gap: 12px; }
  .hd-jp-face { position: relative; flex: none; width: 60px; height: 60px; border-radius: 18px; overflow: hidden; background: #e9e7f2 center / cover no-repeat; box-shadow: 0 0 0 1px rgb(15 23 42 / .06); }
  .hd-jp-face video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; transition: opacity .35s ease; }
  .hd-jp-face video.speak, .hd-jp-face video.greet { opacity: 0; }
  .hd-jp.talking .hd-jp-face video.speak { opacity: 1; }
  /* the first time the panel opens she greets the visitor: her greeting clip plays once */
  .hd-jp.greeting .hd-jp-face video.greet { opacity: 1; }
  .hd-jp.greeting .hd-jp-face video.speak { opacity: 0; }
  /* Jess is the subject of the panel, not an icon in its corner: a real portrait that moves */
  .hd-jp-face { width: 92px !important; height: 92px !important; border-radius: 24px !important; }
  .hd-jp.greeting .hd-jp-face { animation: hd-jp-pop .7s cubic-bezier(.2,.9,.25,1.15) both; }
  @keyframes hd-jp-pop { from { scale: .78; opacity: 0; } to { scale: 1; opacity: 1; } }
  .hd-jp-face::before { content: ""; position: absolute; inset: -6px; z-index: -1; border-radius: 30px; background: conic-gradient(from 210deg, #4F85E8, #9879D5, #6E7BFF, #4F85E8); opacity: 0; filter: blur(8px); transition: opacity .4s ease; }
  .hd-jp-head { isolation: isolate; }
  .hd-jp-face { overflow: visible !important; }
  .hd-jp-face video { border-radius: 24px; }
  .hd-jp.talking .hd-jp-face::before, .hd-jp.greeting .hd-jp-face::before { opacity: .55; }
  .hd-jp-who b { font-size: 18px !important; }
  .hd-jp-status { transition: color .3s; }
  .hd-jp.talking .hd-jp-status { color: #5e6ad2; }
  /* opened from somewhere other than the navbar button: it sits in the bottom corner */
  .hd-jp.corner { top: auto !important; right: 24px !important; bottom: 24px; transform-origin: 100% 100%; translate: 0 10px; }
  .hd-jp.corner.on { translate: 0 0; }
  @media (max-width: 639px) { .hd-jp-face { width: 72px !important; height: 72px !important; border-radius: 20px !important; } .hd-jp-face video { border-radius: 20px; } }
  .hd-jp-face::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px rgb(110 123 255 / 0); transition: box-shadow .3s ease; }
  .hd-jp.talking .hd-jp-face::after { box-shadow: inset 0 0 0 2px rgb(110 123 255 / .85); }
  .hd-jp-who { flex: 1; min-width: 0; }
  .hd-jp-who b { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; letter-spacing: -.01em; line-height: 1.2; }
  .hd-jp-who b span { height: 18px; padding: 0 7px; border-radius: 999px; background: rgb(94 106 210 / .1); color: #5e6ad2; font-size: 10.5px; font-weight: 600; line-height: 18px; letter-spacing: .02em; }
  .hd-jp-who small { display: flex; align-items: center; gap: 6px; margin-top: 3px; color: #64748b; font-size: 12.5px; }
  /* three bars that move while she is "speaking" */
  .hd-jp-bars { display: inline-flex; align-items: center; gap: 2px; height: 10px; }
  .hd-jp-bars i { width: 2px; height: 3px; border-radius: 1px; background: #94a3b8; transition: background-color .3s; }
  .hd-jp.talking .hd-jp-bars i { background: #6e7bff; animation: hd-jp-bar .7s ease-in-out infinite; }
  .hd-jp.talking .hd-jp-bars i:nth-child(2) { animation-delay: .12s; } .hd-jp.talking .hd-jp-bars i:nth-child(3) { animation-delay: .24s; }
  @keyframes hd-jp-bar { 0%, 100% { height: 3px; } 50% { height: 10px; } }
  .hd-jp-x { flex: none; align-self: flex-start; width: 28px; height: 28px; margin: -4px -4px 0 0; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; color: #64748b; cursor: pointer; }
  .hd-jp-x:hover { background: rgb(15 23 42 / .06); color: #0f172a; }
  .hd-jp-log { margin-top: 14px; max-height: min(230px, 34vh); overflow-y: auto; display: grid; gap: 8px; overscroll-behavior: contain; }
  .hd-jp-msg { max-width: 92%; padding: 10px 13px; border-radius: 4px 14px 14px 14px; background: #f4f3f8; color: #1e293b; }
  .hd-jp-msg.me { justify-self: end; border-radius: 14px 4px 14px 14px; background: #0f172a; color: #fff; }
  .hd-jp-msg a { display: inline-block; margin-top: 6px; color: #5e6ad2; font-weight: 600; font-size: 13px; cursor: pointer; }
  .hd-jp-brief { padding: 10px 13px 12px; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px rgb(110 123 255 / .3); }
  .hd-jp-brief > div:not(.go) { display: grid; grid-template-columns: 78px 1fr; gap: 8px; padding: 5px 0; align-items: baseline; }
  .hd-jp-brief span { color: #94a3b8; font-family: var(--font-mono, ui-monospace, monospace); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; }
  .hd-jp-brief b { font-weight: 500; color: #0f172a; font-size: 13.5px; overflow-wrap: anywhere; }
  .hd-jp-brief .go { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
  .hd-jp-brief .go button { height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid #1e293b; background: #0f172a; color: #fff; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
  .hd-jp-brief .go a { color: #64748b; font-size: 12.5px; }
  .hd-jp-chips[hidden] { display: none; }
  .hd-jp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .hd-jp-chips button { height: 30px; padding: 0 12px; border-radius: 999px; border: 0; background: #fff; box-shadow: inset 0 0 0 1px rgb(15 23 42 / .1); color: #334155; font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer;
    transition: box-shadow .2s, color .2s, translate .2s; }
  .hd-jp-chips button:hover { color: #5e6ad2; box-shadow: inset 0 0 0 1px rgb(94 106 210 / .5); translate: 0 -1px; }
  .hd-jp-chips button[disabled] { opacity: .45; pointer-events: none; }
  .hd-jp-form { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 5px 5px 5px 16px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 1px rgb(110 123 255 / .35); transition: box-shadow .2s; }
  .hd-jp-form:focus-within { box-shadow: inset 0 0 0 1.5px #6e7bff, 0 0 0 4px rgb(110 123 255 / .14); }
  .hd-jp-form input { flex: 1; min-width: 0; height: 38px; border: 0; outline: 0; background: none; color: #0f172a; font: inherit; font-size: 14.5px; }
  .hd-jp-form input::placeholder { color: #94a3b8; }
  .hd-jp-form button { flex: none; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; border: 1px solid #1e293b; background: #0f172a; color: #fff; cursor: pointer; }
  .hd-jp-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; color: #94a3b8; font-size: 12px; }
  .hd-jp-foot button { padding: 2px 0; border: 0; background: none; color: #5e6ad2; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
  .hd-jp button:focus-visible, .hd-jp a:focus-visible { outline: 2px solid #6e7bff; outline-offset: 2px; }
  html.hd-jess-open .hd-fw-wrap { opacity: 0 !important; pointer-events: none !important; }
  /* the chat's own "Ask Jess" launcher would sit on top of the panel's send button: Jess is already open */
  html.hd-jess-open iframe[title="Handsdown chat"] { visibility: hidden !important; }
  @media (max-width: 639px) {
    .hd-jp { top: auto !important; right: 8px !important; left: 8px; bottom: max(8px, env(safe-area-inset-bottom)); width: auto; max-width: none; border-radius: 16px; translate: 0 24px; scale: 1; transform-origin: 50% 100%; }
    .hd-jp-log { max-height: min(220px, 30vh); }
  }
  /* ---- the panel as a column of the layout (replaces the popover placement above) ---- */
  .hd-jp, .hd-jp.corner { top: 0 !important; right: 0 !important; bottom: 0; left: auto; width: var(--jw, 380px); max-width: none; display: flex; flex-direction: column;
    padding: 22px 20px 18px; border-radius: 0; background: var(--color-background-raised, #fff); -webkit-backdrop-filter: none; backdrop-filter: none;
    box-shadow: -1px 0 0 rgb(2 6 23 / .08); opacity: 1; scale: 1; translate: 100% 0; transform-origin: 100% 50%;
    transition: translate .36s cubic-bezier(.4, 0, .2, 1), visibility 0s linear .36s; }
  .hd-jp.on, .hd-jp.corner.on { translate: 0 0; transition: translate .36s cubic-bezier(.4, 0, .2, 1); }
  .hd-jp-log { flex: 1 1 auto; min-height: 0; max-height: none; align-content: start; }
  .hd-jp-chips, .hd-jp-form, .hd-jp-foot { flex: none; }
  /* no room beside the page (window under 1024px): a band along the bottom, and the page grows by its height */
  html.hd-jess-narrow .hd-jp, html.hd-jess-narrow .hd-jp.corner { top: auto !important; left: 0; width: auto; height: var(--jh, min(58dvh, 480px)); padding: 16px 16px 14px; border-radius: 22px 22px 0 0;
    box-shadow: 0 -1px 0 rgb(2 6 23 / .08), 0 -24px 50px -34px rgb(20 16 60 / .5); translate: 0 100%; transform-origin: 50% 100%; }
  html.hd-jess-narrow .hd-jp.on, html.hd-jess-narrow .hd-jp.corner.on { translate: 0 0; }
  html.hd-jess-narrow.hd-jess-open body { padding-bottom: min(58dvh, 480px); }
  html.hd-jess-narrow body { transition: padding-bottom .36s cubic-bezier(.4, 0, .2, 1); }
  /* this site: the page narrows to make room for the column (desktop) */
  body { transition: margin-right .36s cubic-bezier(.4, 0, .2, 1); }
  html.hd-jess-open:not(.hd-jess-narrow) body { margin-right: var(--hd-jw, 380px); }
  @media (prefers-reduced-motion: reduce) { body { transition: none; } .hd-jp, .hd-jp-face video { transition: none !important; } .hd-jp.talking .hd-jp-bars i { animation: none; height: 8px; } }`;
  const style = document.createElement('style');
  style.textContent = css + (TALENT ? `
  /* talent mode: questions are asked from the page's own "Ask Jess" field, so the chat's launcher pill is not shown */
  iframe[title="Handsdown chat"] { display: none !important; }
  .hd-jp-foot [data-full] { visibility: hidden; }` : '');
  document.head.appendChild(style);

  let panel, log, input, chips, anchor = null, typing = 0;
  const isTrigger = (a) => !!a && a.matches('[data-jess]');   // every "Describe your role" button on the page
  const inHeader = (a) => !!a && !!a.closest('header');

  function build() {
    panel = document.createElement('div');
    panel.className = 'hd-jp'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat with Jess, AI talent partner');
    panel.innerHTML = `
      <div class="hd-jp-head">
        <div class="hd-jp-face" style="background-image:url(${VIDEO.poster})">
          <video class="idle" muted loop playsinline preload="none" poster="${VIDEO.poster}" src="${VIDEO.idle}"></video>
          <video class="speak" muted loop playsinline preload="none" src="${VIDEO.speak}"></video>
          <video class="greet" muted playsinline preload="none" src="${VIDEO.greet}"></video>
        </div>
        <div class="hd-jp-who"><b>Jess <span>AI</span></b><small><span class="hd-jp-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="hd-jp-status">Your talent partner at handsdown</span></small></div>
        <button type="button" class="hd-jp-x" aria-label="Close"><svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9"/></svg></button>
      </div>
      <div class="hd-jp-log" aria-live="polite"></div>
      <div class="hd-jp-chips">${FAQ.map((f, i) => `<button type="button" data-q="${i}">${f[0]}</button>`).join('')}</div>
      <form class="hd-jp-form" novalidate><input type="text" autocomplete="off" enterkeyhint="send" maxlength="400" placeholder="${TALENT ? 'Ask Jess a question…' : 'I’m looking for a…'}" aria-label="${TALENT ? 'Ask Jess a question' : 'Describe the role you\'re hiring for'}">
        <button type="submit" aria-label="Send to Jess"><svg width="11" height="9" viewBox="0 0 10 8" fill="none" aria-hidden="true"><path d="M6 0 5.3.7l2.8 2.8H0v1h8.1L5.3 7.3l.7.7L10 4 6 0Z" fill="currentColor"/></svg></button></form>
      <div class="hd-jp-foot"><button type="button" data-full>Open full conversation →</button><span>AI agent</span></div>`;
    document.body.appendChild(panel);
    log = panel.querySelector('.hd-jp-log'); input = panel.querySelector('input'); chips = panel.querySelector('.hd-jp-chips');

    panel.querySelector('.hd-jp-x').addEventListener('click', () => close(true));
    panel.querySelector('[data-full]').addEventListener('click', () => { close(); handOff(''); });
    panel.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const text = input.value.trim().slice(0, 400); if (!text) return input.focus(); input.value = ''; hear(text); });
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.q != null) ask(+b.dataset.q); else if (b.dataset.pick != null) hear(b.dataset.pick);
    });
    log.addEventListener('click', (e) => {
      const a = e.target.closest('[data-more]'); if (a) { e.preventDefault(); close(); return handOff(a.dataset.more); }
      if (e.target.closest('[data-again]')) { e.preventDefault(); restart(); }
    });
  }

  // The full experience, exactly as the site opens it: the Smart Match conversation.
  function handOff(text) {
    const detail = { viaJess: true, initialMessage: text, requestId: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `sm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`, presentation: 'immersive' };
    window.__blfxPendingAgentJourney = detail;
    window.dispatchEvent(new CustomEvent('blureffect:open-agent-journey', { detail: { ...detail } }));
  }

  // Jess "says" a line: it types out while her speaking loop plays, then she goes back to idle.
  const status = (t) => { const s = panel.querySelector('.hd-jp-status'); if (s) s.textContent = t; };
  function say(text, more, then) {
    const run = ++typing, el = document.createElement('div');
    el.className = 'hd-jp-msg'; log.appendChild(el);
    const done = () => {
      el.textContent = text;
      if (more) { const a = document.createElement('a'); a.href = '#'; a.dataset.more = more; a.textContent = 'Keep talking in the full chat →'; el.append(document.createElement('br'), a); }
      panel.classList.remove('talking'); status('Your talent partner at handsdown'); log.scrollTop = log.scrollHeight;
      if (then) then();
    };
    if (reduced) return done();
    panel.classList.add('talking'); status('Speaking…');   // her status line says what she is doing
    let n = 0;
    const step = () => {
      if (run !== typing) return;                       // a newer line took over
      n = Math.min(text.length, n + 2); el.textContent = text.slice(0, n); log.scrollTop = log.scrollHeight;
      if (n < text.length) setTimeout(step, 18); else done();
    };
    setTimeout(step, 260);
  }
  const mine = (text) => { const q = document.createElement('div'); q.className = 'hd-jp-msg me'; q.textContent = text; log.appendChild(q); log.scrollTop = log.scrollHeight; };
  const asked = new Set();
  // The row of quick replies under the thread: common questions at first, answer options mid-brief.
  function showFaq() { chips.innerHTML = FAQ.map((f, i) => (asked.has(i) ? '' : `<button type="button" data-q="${i}">${f[0]}</button>`)).join(''); chips.hidden = !chips.children.length; }
  function showOptions(list) { chips.innerHTML = list.map((o) => `<button type="button" data-pick="${o}">${o}</button>`).join(''); chips.hidden = false; }
  function ask(i) {
    mine(FAQ[i][0]); asked.add(i); chips.hidden = true;  // answered: one tap each
    say(FAQ[i][1], TALENT ? null : FAQ[i][0], () => (step ? showOptions(STEPS[step - 1].options) : showFaq()));
  }

  // The start of the brief happens here, in the panel: the role, then two quick choices. Only
  // when there is something worth continuing does Jess offer the full conversation, and the
  // visitor decides. Nothing opens by itself.
  const STEPS = [
    { key: 'Seniority', q: 'What seniority do you need?', options: ['Senior', 'Staff', 'Lead / Principal'] },   // all talent is senior or above
    { key: 'Hours', q: 'And how much overlap with your team’s hours?', options: ['Full US hours', '4+ hours overlap', 'Flexible'] },
  ];
  const WHICH = [/vet|screen|check|quality/i, /fast|soon|quick|how long|timeline|start/i, /cost|price|pricing|rate|budget|how much/i];
  let step = 0, brief = {};
  // A profile handed over by the page (hire.html's search and its chips, see hire-search.js):
  // Jess answers with what that profile covers, then starts the brief with it as the role.
  function hearProfile(text, P) {
    typing += 1; panel.classList.remove('talking');
    log.querySelectorAll('.hd-jp-brief').forEach((n) => n.remove());
    mine(text); chips.hidden = true;
    // a whole capability (P.pick): she lists the roles in it and the visitor picks one
    if (P.pick) { brief = {}; step = 0; input.placeholder = 'I’m looking for a…'; } else { brief = { Role: P.role }; step = 1; input.placeholder = 'Or type your answer…'; }
    say(P.say, null, () => {
      const el = document.createElement('div');
      el.className = 'hd-jp-brief';
      el.innerHTML = P.rows.map(() => '<div><span></span><b></b></div>').join('');
      el.querySelectorAll('div').forEach((d, i) => { d.querySelector('span').textContent = P.rows[i][0]; d.querySelector('b').textContent = P.rows[i][1]; });
      log.appendChild(el); log.scrollTop = log.scrollHeight;
      if (P.pick) return say('Which of these is closest to what you need? Or type the role.', null, () => showOptions(P.pick));
      say(`To shape the brief: ${STEPS[0].q.charAt(0).toLowerCase()}${STEPS[0].q.slice(1)}`, null, () => showOptions(STEPS[0].options));
    });
  }
  function hear(text) {
    if (TALENT) {                                         // an applicant's question: an answer, never a brief
      mine(text); chips.hidden = true;
      const i = WHICH_T.findIndex((r) => r.test(text));
      if (i >= 0) asked.add(i);
      return say(i >= 0 ? FAQ[i][1] : FALLBACK_T, null, showFaq);
    }
    const faq = /\?\s*$/.test(text) || step === 0 ? WHICH.findIndex((r) => r.test(text)) : -1;
    if (faq >= 0 && /\?|^(what|how|when|why|do|does|can|is|are)\b/i.test(text)) { mine(text); asked.add(faq); chips.hidden = true; return say(FAQ[faq][1], FAQ[faq][0], () => (step ? showOptions(STEPS[step - 1].options) : showFaq())); }
    mine(text); chips.hidden = true;
    if (step === 0) {
      brief = { Role: text.replace(/^(i[’']?m|we[’']?re|i am|we are)\s+looking for\s+/i, '').replace(/^(an?|the)\s+/i, '').replace(/[.\s]+$/, '') };
      brief.Role = brief.Role.charAt(0).toUpperCase() + brief.Role.slice(1);
      step = 1; input.placeholder = 'Or type your answer…';
      return say(`Got it: ${brief.Role}. Two quick questions and I’ll have a first brief. ${STEPS[0].q}`, null, () => showOptions(STEPS[0].options));
    }
    if (step > STEPS.length) {                           // the brief exists: anything else typed is a detail for it
      brief.Role += ` · ${text}`;
      log.querySelectorAll('.hd-jp-brief').forEach((n) => n.remove());
      return say('Added to the brief.', null, summary);
    }
    brief[STEPS[step - 1].key] = text;
    if (step < STEPS.length) { step += 1; return say(STEPS[step - 1].q, null, () => showOptions(STEPS[step - 1].options)); }
    step = STEPS.length + 1; input.placeholder = 'Add a detail, or ask me something…';
    say('Here’s your brief so far. I can take it from here whenever you’re ready.', null, summary);
  }
  function summary() {
    const el = document.createElement('div');
    el.className = 'hd-jp-brief';
    const text = `${brief.Role}. Seniority: ${brief.Seniority}. Hours: ${brief.Hours}.`;
    el.innerHTML = `${['Role', 'Seniority', 'Hours'].map((k) => `<div><span>${k}</span><b></b></div>`).join('')}<div class="go"><button type="button" data-more="">Continue with Jess →</button><a href="#" data-again>Start over</a></div>`;
    el.querySelectorAll('b').forEach((b, i) => (b.textContent = brief[['Role', 'Seniority', 'Hours'][i]]));
    el.querySelector('[data-more]').dataset.more = text;
    log.appendChild(el); log.scrollTop = log.scrollHeight;
    showFaq();
  }
  function restart() { typing += 1; step = 0; brief = {}; log.innerHTML = ''; input.placeholder = 'I’m looking for a…'; panel.classList.remove('talking'); say(HELLO, null, showFaq); }

  // The conversation is a column of the layout, not a layer over it. On desktop it takes a strip
  // on the right and the page narrows to make room: this uses the site's own docking mechanism
  // (the "blureffect:agent-view" event sets --agent-dock-inset and the page resizes with its own
  // transition), so the header, hero and every section reflow exactly as they do for the build's
  // docked chat. Below 1024px there is no room side by side: it docks along
  // the bottom instead and the page gains that much space at its end.
  const dockWidth = () => Math.round(Math.min(440, Math.max(360, window.innerWidth * 0.3)));
  const wide = () => window.innerWidth >= 1024;
  const mode = () => document.documentElement.classList.toggle('hd-jess-narrow', !wide());
  function room(on) {
    mode();
    const w = dockWidth();
    if (panel) panel.style.setProperty('--jw', w + 'px');
    document.documentElement.style.setProperty('--hd-jw', w + 'px');
    const detail = on && wide() ? { view: 'open', docked: true, dockWidth: w, jess: true } : { view: 'closed', jess: true };
    window.dispatchEvent(new CustomEvent('blureffect:agent-view', { detail }));
  }
  function place() { if (isOpen()) room(true); }
  // a: the navbar button it hangs from, or null to sit in the corner. text: something the visitor
  // already typed elsewhere on the page, which Jess picks up as if it had been typed here.
  function open(a, text, profile, fresh) {
    if (!panel) build();
    anchor = a || null; place();
    const first = !log.children.length;
    panel.classList.add('on'); document.documentElement.classList.add('hd-jess-open'); room(true);
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    panel.querySelectorAll('video.idle, video.speak').forEach(play);
    if (first && !reduced) {                              // her greeting clip, once
      const g = panel.querySelector('video.greet');
      panel.classList.add('greeting'); g.currentTime = 0; play(g);
      const done = () => panel.classList.remove('greeting');
      g.addEventListener('ended', done, { once: true }); setTimeout(done, 5200);
    }
    if (text && profile) { if (first) chips.hidden = true; hearProfile(text, profile); }
    else if (text) {
      if (first) chips.hidden = true;
      if (fresh && step) { typing += 1; panel.classList.remove('talking'); step = 0; brief = {}; log.querySelectorAll('.hd-jp-brief').forEach((n) => n.remove()); } // a new search starts a new brief
      hear(text);
    }
    else if (first) { chips.hidden = true; say(HELLO, null, showFaq); }
    if (!matchMedia('(max-width: 639px)').matches) setTimeout(() => input.focus({ preventScroll: true }), 120); // no keyboard pop-up on phones
  }
  function close(refocus) {
    if (!panel || !panel.classList.contains('on')) return;
    panel.classList.remove('on'); document.documentElement.classList.remove('hd-jess-open'); room(false);
    panel.querySelectorAll('video').forEach((v) => v.pause());
    if (anchor) { anchor.setAttribute('aria-expanded', 'false'); if (refocus) anchor.focus({ preventScroll: true }); }
  }
  const isOpen = () => !!panel && panel.classList.contains('on');

  // Every "Describe your role" button on the page (marked data-jess) toggles the panel; the
  // navbar's hangs it from the button, the others open it the same way.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-jess]');
    if (!isTrigger(a)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (isOpen() && inHeader(a)) close(true); else open(inHeader(a) ? a : null);
  }, true);
  // Every other way into the chat (the hero field, the closing section's field and chips, the
  // floating search, "Find talent" in the map story and on the team cards) asks the site to open
  // the full conversation. Those requests are caught here and brought to Jess's panel instead,
  // along with whatever the visitor typed. Only the panel's own hand-off goes through.
  window.addEventListener('blureffect:open-agent-journey', (e) => {
    const d = e.detail;
    if (!d || d.viaJess) return;
    e.stopImmediatePropagation();
    delete window.__blfxPendingAgentJourney;
    const text = typeof d.initialMessage === 'string' ? d.initialMessage.trim() : '';
    if (isOpen() && !text) return;
    open(isOpen() ? anchor : null, text, d.hdProfile || null, !!d.hdJess);
  }, true);
  // No click-outside dismissal: this is a column the visitor works beside. Esc, the close button or the navbar button close it.
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(true); });
  window.addEventListener('resize', () => { mode(); place(); });
  mode();
  // The page asks the chat to step aside at the dark map story (see shim.js): the column obeys too.
  window.addEventListener('blureffect:close-agent-journey', () => close());
  window.addEventListener('blureffect:agent-view', (e) => { if (e.detail && !e.detail.jess && e.detail.view !== 'closed') close(); }); // the full chat took over
})();
