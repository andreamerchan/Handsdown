// PROTOTYPE-ONLY fake of the agents webchat API (/v1/agents/webchat/*), loaded inside the widget
// iframe before the widget bundle. It mints a session, holds the SSE stream open and plays a
// scripted Smart Match conversation with "Jess" in the same wire frames the real api emits
// (turn_started → text_delta… → block → agent_message → turn_completed).
(() => {
  const enc = new TextEncoder();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rid = (n = 32) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b & 63]).join('');
  const json = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  // Every visit starts a fresh conversation.
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('blfx_webchat')) localStorage.removeItem(k); } catch {}
  try { for (const k of Object.keys(sessionStorage)) if (k.startsWith('blfx_webchat')) sessionStorage.removeItem(k); } catch {}

  // The page folds the dock away by itself at the map section (shim.js). That close must not be
  // remembered as the visitor's choice, or the chat would start closed on the next page load.
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || e.data?.source !== 'hd-proto' || e.data.type !== 'forget-dock') return;
    try { sessionStorage.removeItem('blfx_widget_dock_open'); } catch {}
  });

  const session = { token: rid(), conversationId: crypto.randomUUID(), websiteToken: 'proto', visitId: crypto.randomUUID() };
  const transcript = [];
  let seq = 0, eventId = 0, turnN = 0;
  let controller = null;
  const pending = [];
  const brief = { role: null, answers: {}, email: null };

  // ---------------------------------------------------------------- stream plumbing
  function frame(obj) {
    const chunk = enc.encode(`id: ${++eventId}\ndata: ${JSON.stringify(obj)}\n\n`);
    if (controller) { try { controller.enqueue(chunk); return; } catch { controller = null; } }
    pending.push(chunk);
  }
  function openStream(signal) {
    const stream = new ReadableStream({
      start(c) {
        controller = c;
        c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'connected', conversationId: session.conversationId, fidelity: 'public' })}\n\n`));
        while (pending.length) c.enqueue(pending.shift());
        const ping = setInterval(() => { try { c.enqueue(enc.encode(': ping\n\n')); } catch { clearInterval(ping); } }, 15000);
        signal?.addEventListener('abort', () => { clearInterval(ping); if (controller === c) controller = null; try { c.close(); } catch {} });
      },
      cancel() { controller = null; },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }

  // ---------------------------------------------------------------- the host's spec panel (_hd/spec-panel.js)
  // What Jess is doing and where the brief stands, for the panel beside the conversation. Prototype
  // messages ('hd-proto'), next to the real 'brief' one; the panel shows nothing it does not get here.
  const host = (type, data) => { try { window.parent.postMessage({ source: 'hd-proto', type, ...data }, '*'); } catch {} };
  const status = (state, label) => host('jess-status', { state, label });
  function publishSpec() {
    const a = brief.answers;
    const stage = brief.booked ? 'booked' : brief.email ? 'booking' : Object.keys(a).length >= 7 ? 'email' : brief.role ? 'details' : 'start';
    host('spec-state', { role: brief.role, answers: { ...a }, email: brief.email, booked: brief.booked || null, stage });
  }

  // ---------------------------------------------------------------- turn helpers
  async function say(turnId, text) {
    // Stream in small pieces at a believable typing speed.
    for (let i = 0; i < text.length; ) {
      const n = 2 + Math.floor(Math.random() * 5);
      frame({ type: 'text_delta', turnId, text: text.slice(i, i + n) });
      i += n;
      await sleep(14 + Math.random() * 22);
    }
  }
  async function tool(turnId, name, label, ms = 900) {
    const id = `call_${rid(10)}`;
    frame({ type: 'block', turnId, block: { kind: 'tool', id, name, status: 'running', label } });
    status('working', `${label}…`);
    await sleep(ms);
    status('writing', 'Writing…');
    frame({ type: 'block', turnId, block: { kind: 'tool', id, name, status: 'ok', label } });
    return id;
  }
  function card(turnId, callId, name, props) {
    frame({ type: 'block', turnId, block: { kind: 'component', id: `${callId}:display`, name, props } });
    return { cellId: `${callId}:display`, name, props };
  }
  async function turn(build) {
    const turnId = `turn_${++turnN}`;
    await sleep(500 + Math.random() * 400);
    frame({ type: 'turn_started', turnId });
    status('thinking', 'Thinking…');
    await sleep(450);
    status('writing', 'Writing…');
    const out = { text: '', displays: [] };
    const api = {
      say: async (t) => { out.text += t; await say(turnId, t); },
      tool: (name, label, ms) => tool(turnId, name, label, ms),
      card: (callId, name, props) => out.displays.push(card(turnId, callId, name, props)),
    };
    await build(api);
    const messageId = crypto.randomUUID();
    frame({ type: 'agent_message', turnId, messageId, text: out.text });
    frame({ type: 'turn_completed', turnId, stopReason: 'end_turn' });
    status('listening', 'Waiting for your answer');
    publishSpec();
    transcript.push({ id: messageId, role: 'agent', senderType: 'ai', text: out.text, seq: ++seq, createdAt: new Date().toISOString(), turnId, displays: out.displays });
  }

  // The brief the host shows in its companion pane: the panel's own eight rows, in its order
  // (same message the real iframe sends after reading the brief state).
  function publishBrief() {
    if (!brief.role) return;
    const a = brief.answers;
    const v = (x) => (x ? [x] : []);
    const list = (x) => (x ? x.split(/,\s*|\s+and\s+/).filter(Boolean) : []);
    const rows = [
      { label: 'Role title', values: [brief.role] },
      { label: 'Seniority', values: v(a.seniority) },
      { label: 'Required tech', values: list(a.stack) },
      { label: 'Soft skills', values: list(a.soft_skills) },
      { label: 'Time zone', values: v(a.timezone) },
      { label: 'Team size', values: v(a.team_size) },
      { label: 'Budget', values: v(a.budget) },
      { label: 'Duration', values: v(a.duration) },
    ];
    window.parent.postMessage({ source: 'blfx-widget', type: 'brief', roles: [{ title: brief.role, detailed: Object.keys(a).length > 0, fields: rows }], fields: rows }, '*');
  }

  function roleFrom(text) {
    const t = text.toLowerCase();
    if (/design|ux|ui\b/.test(t)) return 'Senior Product Designer';
    if (/data scien|machine learning|\bml\b/.test(t)) return 'Senior Data Scientist';
    if (/\bai\b|llm|rag|agent/.test(t)) return 'Senior AI Engineer';
    if (/data eng|analytics|warehouse|bi\b/.test(t)) return 'Senior Data Engineer';
    if (/mobile|ios|android|react native/.test(t)) return 'Senior Mobile Engineer';
    if (/devops|sre|platform|infra/.test(t)) return 'Senior DevOps Engineer';
    if (/front|react|next/.test(t)) return 'Senior Frontend Engineer';
    if (/back|node|python|java|go\b/.test(t)) return 'Senior Backend Engineer';
    if (/product manager|\bpm\b/.test(t)) return 'Senior Product Manager';
    return 'Senior Software Engineer';
  }
  function nextSlots() {
    const slots = [];
    const d = new Date();
    for (let added = 0; added < 3; ) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const day = d.toISOString().slice(0, 10);
      const hour = ['10:00', '13:30', '16:00'][added];
      slots.push({ id: `slot_${added + 1}`, start: `${day}T${hour}:00-05:00` });
      added++;
    }
    return slots;
  }

  // ---------------------------------------------------------------- the script
  const QUIZ = { actionId: 'submit-discovery-quiz', submissionPrefix: 'Discovery answers:', submitLabel: 'Submit' };
  // FAQ answers use the site's own copy (pricing page, home "five checks", how it works).
  const FAQ = [
    [/vet|screen|check|quality/i, "Every candidate goes through five checks: a skills screen scored against your role spec, a structured interview with the same questions and rating scale for everyone, a real work sample (AI tools allowed), a fit check against your team, and a fairness check that audits scoring for bias before ranking. You meet a shortlist, not a pile of CVs."],
    [/cost|price|pricing|rate|budget|how much/i, "Starting costs nothing: defining the role is free, and the written role is yours whether you hire through us or not. For reference, a full-time senior specialist runs about **$7,500 – $10,000 a month**, against $17,000 – $20,500 for the same hire in-house in the US. Your exact rate is confirmed in writing before anything starts."],
    [/fast|soon|quick|how long|timeline|start/i, "It depends on the role. Once your role spec is set, we reach out to specialists and you meet a shortlist of people who already said yes to your role, each scored against it. You interview, you decide, and a talent partner gives you a concrete timeline on the call."],
  ];

  async function respond(text) {
    const t = text.trim();
    if (t.startsWith('Discovery answers:')) {
      for (const line of t.split('\n').slice(1)) {
        const m = /^([^:]+):\s*(.*)$/.exec(line);
        if (m && m[2]) brief.answers[m[1].trim()] = m[2].trim();
      }
      publishBrief();
      brief.quizzes = (brief.quizzes || 1) + 1;
      if (brief.quizzes === 2) {
        return turn(async (j) => {
          await j.say('Great, that helps. Last few, about the engagement:');
          const id = await j.tool('offer_discovery_quiz', 'Preparing a few questions', 600);
          j.card(id, 'discovery_quiz', {
            title: 'About the engagement', ...QUIZ,
            questions: [
              { id: 'budget', prompt: 'Monthly budget per person?', options: ['Under $7,500', '$7,500 – $10,000', 'Over $10,000'] },
              { id: 'duration', prompt: 'How long do you need them?', options: ['3 months', '6 months', 'Ongoing'] },
              { id: 'soft_skills', prompt: 'Any soft skills that matter most?', options: [] },
            ],
          });
        });
      }
      const a = brief.answers;
      return turn(async (j) => {
        await j.say(`Perfect, here's the role as I understand it:\n\n**${brief.role}**\n`);
        await j.say([
          a.seniority && `- **Seniority:** ${a.seniority}`,
          a.stack && `- **Stack:** ${a.stack}`,
          a.timezone && `- **Time zone:** ${a.timezone}`,
          a.team_size && `- **Team size:** ${a.team_size}`,
          a.budget && `- **Budget:** ${a.budget}`,
          a.duration && `- **Duration:** ${a.duration}`,
        ].filter(Boolean).join('\n') + '\n\n');
        await j.say("I'll turn this into a science-backed role spec. What's the best email to send it to? A talent partner will follow up from there.");
      });
    }
    if (t.startsWith('Book this time:')) {
      const label = t.split('\n')[0].replace('Book this time:', '').trim();
      brief.booked = label;
      return turn(async (j) => {
        await j.say('Booking that for you…\n\n');
        await j.tool('book_meeting', 'Booking your call', 1200);
        await j.say(`You're all set for **${label}**. ${brief.email ? `The invite is on its way to ${brief.email}.` : "You'll get a calendar invite shortly."}\n\n`);
        await j.say("On the call your talent partner confirms the role spec and walks you through the shortlist. Anything else you'd like the team to know before then?");
      });
    }
    const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(t)?.[0];
    if (email) {
      brief.email = email;
      return turn(async (j) => {
        await j.say('Thanks! Saving your brief…\n\n');
        await j.tool('record_visitor_facts', 'Saving your details', 900);
        publishBrief();
        await j.say(`Done. Your role spec goes to **${email}**.\n\nNext step is a 20-minute call with a talent partner. They'll confirm the details and walk you through the shortlist. Pick a time that works:`);
        const id = await j.tool('offer_meeting_times', 'Finding open times', 700);
        j.card(id, 'booking_slots', { slots: nextSlots(), timeZone: 'America/New_York', actionId: 'pick-meeting-time', submissionPrefix: 'Book this time:', title: 'Pick a time', submitLabel: 'Confirm' });
      });
    }
    if (/book a call|book a meeting|schedule|talk to (a|someone)|meeting/i.test(t)) {
      return turn(async (j) => {
        if (!brief.email) {
          await j.say("Happy to set that up. What's the best email for the calendar invite?");
          return;
        }
        await j.say('Here are the next open times with a talent partner:');
        const id = await j.tool('offer_meeting_times', 'Finding open times', 700);
        j.card(id, 'booking_slots', { slots: nextSlots(), timeZone: 'America/New_York', actionId: 'pick-meeting-time', submissionPrefix: 'Book this time:', title: 'Pick a time', submitLabel: 'Confirm' });
      });
    }
    const faq = FAQ.find(([re]) => re.test(t));
    if (faq && t.length < 80) {
      return turn(async (j) => {
        await j.say(faq[1]);
        if (!brief.role) {
          await j.say('\n\nWhat role are you looking to fill? One line is enough.');
          const id = await j.tool('offer_next_step', 'Suggestions', 300);
          j.card(id, 'quick_replies', { prompts: ['A senior React engineer', 'A product designer', 'A data scientist'] });
        }
      });
    }
    if (!brief.role) {
      brief.role = roleFrom(t);
      publishBrief();
      return turn(async (j) => {
        await j.say(`Great, a **${brief.role}**. A few quick questions so I can shape the brief:`);
        const id = await j.tool('offer_discovery_quiz', 'Preparing a few questions', 700);
        j.card(id, 'discovery_quiz', {
          title: 'About the role', ...QUIZ,
          questions: [
            { id: 'seniority', prompt: 'What seniority are you hiring for?', options: ['Senior', 'Staff', 'Lead / Principal'] },
            { id: 'stack', prompt: 'Main stack or tools?', options: [] },
            { id: 'timezone', prompt: 'Which time zone should they work in?', options: ['US Eastern', 'US Pacific', 'Flexible'] },
            { id: 'team_size', prompt: 'How many people do you need?', options: ['1 person', '2–3 people', '4+ people'] },
          ],
        });
      });
    }
    if (!brief.email) {
      return turn(async (j) => {
        await j.say("Got it, I've noted that. What's the best email to send your role spec to?");
      });
    }
    return turn(async (j) => {
      await j.say("Noted, I'll pass that to your talent partner so it's covered on the call.");
    });
  }

  // Analytics beacons have nowhere to go from file://.
  if (navigator.sendBeacon) {
    const realBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => { try { if (new URL(String(url), location.href).protocol === 'file:') return true; } catch {} return realBeacon(url, data); };
  }

  // ---------------------------------------------------------------- fetch routes
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    const path = (() => { try { return new URL(url, 'http://x/').pathname; } catch { return url; } })();
    const m = /\/webchat\/sessions(?:\/([^/]+))?(\/.*)?$/.exec(path);
    if (!m) {
      if (/^(\/|file:)/.test(url)) return json(503, null);
      return realFetch(input, init);
    }
    const [, tok, rest = ''] = m;
    const body = (() => { try { return init.body ? JSON.parse(init.body) : {}; } catch { return {}; } })();
    if (!tok && method === 'POST') {
      return json(201, {
        token: session.token, resumeToken: rid(), conversationId: session.conversationId, websiteToken: body.websiteToken || session.websiteToken,
        reattachDeadlineAt: new Date(Date.now() + 86400000).toISOString(), resumeEligible: true, visitId: session.visitId,
        agent: { id: 'jess', versionId: '2026-10-30-jess-feedback-v1', displayName: 'Jess · Handsdown' },
      });
    }
    if (tok === 'resume') return json(404, null); // always start fresh
    if (rest === '/stream') return openStream(init.signal);
    if (rest === '/messages' && method === 'POST') {
      transcript.push({ id: crypto.randomUUID(), role: 'user', senderType: 'visitor', text: body.text || '', seq: ++seq, createdAt: new Date().toISOString(), clientMessageId: body.clientMessageId });
      status('thinking', 'Reading your message…');
      respond(body.text || '');
      return json(202, { messageId: crypto.randomUUID(), deduped: false, visitId: session.visitId });
    }
    if (rest === '/messages') return json(200, { websiteToken: session.websiteToken, messages: transcript });
    if (rest === '/booking-handoff') return json(201, { token: rid(), goalId: crypto.randomUUID() });
    if (/\/turns\/.+\/cancel$/.test(rest)) return json(202, { outcome: 'aborted' });
    if (rest === '/approvals') return json(202, {});
    if (rest === '/speech-input') return json(404, { error: { code: 'speech_input_not_served' } });
    if (rest.startsWith('/clips/')) return json(404, null);
    if (method === 'DELETE' || rest === '/consent' || rest.startsWith('/analytics')) return new Response(null, { status: 204 });
    return json(404, null);
  };
})();
