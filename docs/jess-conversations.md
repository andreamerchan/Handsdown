# Jess panel: conversations, hiring requests and search boxes

How the AI hiring assistant panel (`public/jess/jess-panel.js`) behaves. The panel is the same on every page: a column on the right on desktop, a sheet along the bottom under 1024px.

## Words used here

- **Conversation**: one thread with Jess. Several can be saved; one is open at a time.
- **Hiring request**: what a conversation is about. It holds one or more **requirements**.
- **Requirement**: one role in the request: role name, specialty (detected from the text), seniority, hours overlap and how many people.

## Header

- **Book a call** (always visible). Shows **Call booked** once a call exists.
- **Expand** (always visible). Toggles a wider workspace; the conversation stays where it is.
- **⋯ menu**: New search · Saved conversations · Clear conversation · Delete conversation.
- **×** closes the panel. Nothing is lost.

## Saving and resuming

- Every message and every change is saved right away in the browser (`localStorage`, key `hd_jess_conversations_v1`). If storage is blocked, it is kept in memory for the visit.
- Closing the panel keeps everything. Reopening it (any "Describe your role" button) resumes the open conversation where it was, including the question Jess was asking and its answer options.
- After a page reload, the first open shows "Picking up where you left off."
- Empty conversations are not kept. At most 20 conversations are kept; the oldest go first (never the open one).
- Another tab changing the conversations updates this one.

## Search boxes (hero field, closing section and its chips)

When a search comes in:

1. **Nothing in the open conversation yet** (no role): the search becomes the first role. Jess asks seniority and hours.
2. **The conversation already has a request**: Jess never overwrites it or mixes it in silently. She asks:
   > I see we're already discussing a Frontend Developer. Are you looking to add a Backend Developer to that same hiring request, or would you like to start a separate search?
   - **Add to existing request**: the role is added as its own requirement. Jess asks only what is missing.
   - **Start a new search**: a new conversation starts with this role. The previous one is saved and listed in Saved conversations.
   - **Cancel**: nothing changes.
3. **Same specialty as a role already in the request** (for example Frontend again):
   > You already have a Frontend Developer in this request. Do you need another one, or is this a separate search?
   - **Add another (2 total)**: raises that requirement's count.
   - **Add … as its own role**: only shown when the wording differs (for example "Senior React engineer" next to "Frontend Developer"). Adds a separate requirement.
   - **Start a new search** / **Cancel**: as above.
4. **A second search arrives before the first is answered**: the first question is marked "Replaced by a newer search" and Jess asks about the new one. Only one question is pending at a time.
5. While a question is pending, typing "add", "new" or "cancel" works like the buttons. Anything else gets a reminder to choose.

The same rules apply to a new role typed in the chat. A message that says "also" or "another" ("we also need a QA engineer") adds the role directly, and Jess confirms it.

## Multiple requirements

- Each requirement is its own row in the **Hiring request** box, with **Edit** and **Remove**.
- **Edit**: role name, seniority, hours and how many (1–20). Saving shows "Updated: …". If Jess was asking about that field, she moves on.
- **Remove**: asks inline ("Remove … from this request?"), then shows **Undo** for 8 seconds. If the request becomes empty, Jess asks for a role again.
- **+ Add a role**: Jess asks for the role and adds it to this request without the add-or-new question.
- Seniority in the role text ("Senior backend engineer") is picked up, so Jess asks only for hours.
- Anything typed that isn't a role or a question is added to the request as a **note**.

## Book a call

- **Eligible** when the request has at least one role and every role has seniority and hours.
- **Not eligible yet**: Jess asks for what's missing first (a role, then its details), then continues straight to booking.
- Booking: work email (validated) → three weekday times in ET (US holidays skipped), "Another time" (free text, confirmed by email), or "Not now".
- **Booked**: a confirmation card and **Change time**. The header button turns into **Call booked**; pressing it offers to change the time or keep it.
- On booking the panel fires `hd:jess-call-booked` with the email, the time and the request, for the real scheduling backend to pick up. **Today nothing is sent**: there is no calendar connected.
- If a search is waiting for an answer, Jess asks to settle it before booking.

## Clear vs delete

| | Clear conversation | Delete conversation |
|---|---|---|
| Removes | The messages | The messages **and** the hiring request |
| Keeps | The hiring request, the booked call | Other saved conversations |
| Confirmation | Yes ("Clear messages") | Yes (red "Delete") |
| Undo | 8 seconds | 8 seconds |
| After | Jess picks up at the step she was on | The panel switches to the most recent saved conversation, or a fresh one |

- In both confirmations, **Cancel** has the focus, so pressing Enter by accident doesn't remove anything.
- Clear is disabled with no messages; Delete is disabled for an empty conversation.
- Deleting doesn't cancel a booked call (the confirmation says so).
- A search still waiting for an answer is dropped by Clear (it was never added to the request).

## Saved conversations

- Lists every saved conversation: title (its roles), status (In progress · Request ready · Call booked · Questions only) and last update. The open one is marked **Open now**.
- Clicking one resumes it. Each row can be deleted (same confirmation and undo).
- **+ New search** starts a new conversation. **New search** in the menu does the same; the previous one stays saved.

## Expand and the full chat

- **Expand**: on desktop the panel widens over the page (the page keeps its normal margin) and the hiring request moves to its own column. On small screens it takes the whole screen. The choice is remembered for the visit.
- **Open full conversation** (footer) and **Continue in the full chat** (request card) open the full-screen chat, carrying the request as text. When the visitor leaves the full chat, the panel reopens where it was.

## Keyboard and accessibility

- Esc closes, in order: confirmation → menu → editing → saved list → panel.
- The menu supports arrow keys. Confirmation keeps focus inside it.
- Messages are announced (`aria-live`). Every icon button has a label.

## Apply page (talent mode)

`data-mode="talent"`: Jess answers applicants' questions only. There is no hiring request, booking, saved list or delete. Clear and Expand stay.
