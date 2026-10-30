// Retro Board app: renders from runtime state (db snapshots, room peers) and
// writes through the artifact's db. Pure rules live in logic.mjs.

const S = {
  caps: { db: null, user: null, room: null, sample: null },
  booted: false,
  me: { id: null, isHost: false, canWrite: null },
  retros: [],
  retrosLoaded: false,
  openActions: [],
  route: { view: "auto", rid: null },
  subRid: null,
  prevRid: null,
  data: emptyData(),
  prevActions: [],
  peers: [],
  roomDown: false,
  profiles: {},
  drafts: {},
  ui: {
    error: null,
    confirm: null,
    editing: null,
    renaming: null,
    busy: null,
    grouping: false,
    selected: new Set(),
    dragId: null,
    highlightLoose: false,
    owner: {},
    hits: {},
    pickerOpen: null,
    newRetro: false,
  },
};

function emptyData() {
  return {
    items: [],
    groups: [],
    ballots: [],
    actions: [],
    mine: { items: [], ballots: [] },
    loaded: { items: false, groups: false, ballots: false, actions: false },
  };
}

let unsubRetro = [];
let unsubPrev = null;

// ---------- small DOM helpers ----------

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "value") value = v;
    else if (k === "checked") el.checked = !!v;
    else if (k === "disabled") el.disabled = true;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  if (value !== undefined) el.value = value;
  return el;
}

const ICONS = {
  edit: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  back: "M15 5l-7 7 7 7",
};

function icon(name) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}

function iconBtn(name, label, onClick, extra = "") {
  return h("button", { type: "button", class: `btn btn--quiet icon-btn ${extra}`, "aria-label": label, title: label, onClick }, icon(name));
}

// A text input or textarea whose value survives re-renders.
function field(id, tag, props = {}) {
  const { onInput, ...rest } = props;
  return h(tag, {
    ...rest,
    id,
    class: rest.class || (tag === "textarea" ? "textarea" : "input"),
    value: S.drafts[id] ?? rest.value ?? "",
    onInput: (e) => {
      S.drafts[id] = e.target.value;
      if (onInput) onInput(e);
    },
  });
}

function clearDraft(id) {
  delete S.drafts[id];
}

// ---------- state helpers ----------

function currentRetro() {
  if (S.route.view === "history") return null;
  if (S.route.rid) return S.retros.find((r) => r.id === S.route.rid) || null;
  return activeRetro(S.retros);
}

function canWrite() {
  return S.caps.db && S.me.canWrite !== false;
}

function profile(id) {
  return S.profiles[id] || { id, name: "", avatarUrl: "", color: "" };
}

function nameOf(id) {
  if (id && id === S.me.id) return "You";
  return profile(id).name || "Someone";
}

function peopleHere(rid) {
  const seen = new Map();
  for (const p of S.peers) {
    if (p.kind !== "viewer") continue;
    const pr = p.presence || {};
    if (rid && pr.rid && pr.rid !== rid) continue;
    const key = p.by || p.peer;
    const prev = seen.get(key);
    if (!prev || (pr.votesUsed || 0) > (prev.presence?.votesUsed || 0)) seen.set(key, p);
  }
  return [...seen.values()];
}

function myBallotsIn(groupId) {
  const byId = new Map(S.data.ballots.map((b) => [b.id, b]));
  return S.data.mine.ballots.filter((bid) => byId.get(bid)?.groupId === groupId);
}

function liveMyBallots() {
  return S.data.mine.ballots;
}

async function resolveProfiles() {
  const user = S.caps.user;
  if (!user) return;
  const ids = new Set();
  for (const p of S.peers) if (p.by) ids.add(p.by);
  for (const a of [...S.data.actions, ...S.prevActions]) if (a.ownerId) ids.add(a.ownerId);
  for (const id of Object.values(S.ui.owner)) if (id) ids.add(id);
  if (S.me.id) ids.add(S.me.id);
  if (!ids.size) return;
  const ps = await user.profiles([...ids]);
  let changed = false;
  for (const [id, p] of Object.entries(ps)) {
    const old = S.profiles[id];
    if (!old || old.name !== p.name || old.avatarUrl !== p.avatarUrl) changed = true;
    S.profiles[id] = p;
  }
  if (changed) scheduleRender();
}

// ---------- writes ----------

function fail(e, action) {
  S.ui.error = errorMessage(e?.code, action);
  if (e?.code === "invalid_argument" && S.me.canWrite == null) S.me.canWrite = false;
  scheduleRender();
}

async function run(action, fn) {
  try {
    await fn();
    S.ui.error = null;
    return true;
  } catch (e) {
    fail(e, action);
    return false;
  } finally {
    scheduleRender();
  }
}

let mineChain = Promise.resolve();
function saveMine(rid) {
  const { db } = S.caps;
  if (!db || !S.me.id) return Promise.resolve();
  const body = { items: [...S.data.mine.items], ballots: [...S.data.mine.ballots] };
  const path = `data/users/${S.me.id}/${rid}`;
  mineChain = mineChain.then(() => db.doc(path).set(body)).catch((e) => fail(e, "save that"));
  return mineChain;
}

function setPresence(patch) {
  if (!S.caps.room) return;
  S.caps.room.presence(patch).catch(() => {});
}

let typingTimer = null;
function markTyping(rid) {
  setPresence({ rid, typing: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => setPresence({ typing: false }), 4000);
}

async function createRetro() {
  const { db } = S.caps;
  const title = (S.drafts["new-retro-title"] || "").trim() || defaultRetroTitle();
  const rid = newId("r");
  const ok = await run("start a retro", () =>
    db.doc(`retros/${rid}`).set({ title, createdAt: Date.now(), phase: "lobby", groupingAt: null, participants: 0, summary: null, finishedAt: null })
  );
  if (ok) {
    clearDraft("new-retro-title");
    S.ui.newRetro = false;
    location.hash = `retro-${rid}`;
  }
}

function summaryFor() {
  const top = ranking(S.data.groups, S.data.items, S.data.ballots)
    .slice(0, 3)
    .map((g) => ({ title: g.title, votes: g.votes }));
  return { topGroups: top, cards: S.data.items.length };
}

async function setPhase(retro, phase) {
  const { db } = S.caps;
  const here = peopleHere(retro.id).length;
  const patch = { phase, participants: Math.max(retro.participants || 0, here) };
  if (phase === "results" || phase === "actions" || phase === "done") patch.summary = summaryFor();
  if (phase === "done") patch.finishedAt = Date.now();
  S.ui.confirm = null;
  S.ui.highlightLoose = false;
  await run("change the phase", () => db.doc(`retros/${retro.id}`).update(patch));
}

async function addCard(retro, col) {
  const id = `new-${col}`;
  const text = cleanCardText(S.drafts[id]);
  if (!text) {
    S.ui.error = (S.drafts[id] || "").trim() ? `Cards can be at most ${MAX_CARD_LENGTH} characters.` : null;
    const el = document.getElementById(id);
    if (el) el.setAttribute("aria-invalid", "true");
    scheduleRender();
    return;
  }
  const iid = newId("i");
  const ok = await run("add a card", () =>
    S.caps.db.doc(`items/${iid}`).set({ retroId: retro.id, col, text, groupId: null, createdAt: Date.now() })
  );
  if (ok) {
    clearDraft(id);
    S.data.mine.items = [...S.data.mine.items, iid];
    saveMine(retro.id);
    setPresence({ typing: false });
  }
}

async function saveCardEdit(iid) {
  const id = `edit-${iid}`;
  const text = cleanCardText(S.drafts[id]);
  if (!text) {
    S.ui.error = `A card needs some text, at most ${MAX_CARD_LENGTH} characters.`;
    scheduleRender();
    return;
  }
  const ok = await run("edit this card", () => S.caps.db.doc(`items/${iid}`).update({ text }));
  if (ok) {
    clearDraft(id);
    S.ui.editing = null;
  }
}

async function deleteCard(retro, iid) {
  S.ui.confirm = null;
  const ok = await run("delete this card", () => S.caps.db.doc(`items/${iid}`).delete());
  if (ok && S.data.mine.items.includes(iid)) {
    S.data.mine.items = S.data.mine.items.filter((x) => x !== iid);
    saveMine(retro.id);
  }
}

// ---------- grouping ----------

async function groupWithAI(retro) {
  const { db, sample } = S.caps;
  const items = S.data.items;
  S.ui.confirm = null;
  if (!sample || !items.length || S.ui.grouping) return;
  S.ui.grouping = true;
  S.ui.error = null;
  scheduleRender();
  await db.doc(`retros/${retro.id}`).update({ groupingAt: Date.now() }).catch(() => {});
  try {
    const result = await sample.json(groupingPrompt(items), { modelTier: "default", cache: false });
    const groups = normaliseGroups(items, result);
    if (!groups || !groups.length) throw { code: "invalid_json" };
    for (const g of S.data.groups) await db.doc(`groups/${g.id}`).delete();
    const target = {};
    for (const [order, g] of groups.entries()) {
      const gid = newId("g");
      await db.doc(`groups/${gid}`).set({ retroId: retro.id, title: g.title, order });
      for (const iid of g.itemIds) target[iid] = gid;
    }
    for (const it of items) {
      if (target[it.id] && it.groupId !== target[it.id]) await db.doc(`items/${it.id}`).update({ groupId: target[it.id] });
    }
  } catch (e) {
    S.ui.error = errorMessage(e?.code, "group the cards");
  } finally {
    await db.doc(`retros/${retro.id}`).update({ groupingAt: null }).catch(() => {});
    S.ui.grouping = false;
    scheduleRender();
  }
}

function nextOrder() {
  return S.data.groups.reduce((m, g) => Math.max(m, g.order ?? 0), -1) + 1;
}

async function newGroup(retro, itemIds = []) {
  const { db } = S.caps;
  const gid = newId("g");
  await run("create a group", async () => {
    await db.doc(`groups/${gid}`).set({ retroId: retro.id, title: itemIds.length ? "New theme" : "New group", order: nextOrder() });
    for (const iid of itemIds) await db.doc(`items/${iid}`).update({ groupId: gid });
  });
  S.ui.selected = new Set();
  S.ui.renaming = gid;
  S.drafts[`rename-${gid}`] = itemIds.length ? "New theme" : "New group";
}

async function moveCard(iid, gid) {
  await run("move this card", () => S.caps.db.doc(`items/${iid}`).update({ groupId: gid || null }));
}

async function renameGroup(gid) {
  const title = (S.drafts[`rename-${gid}`] || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!title) {
    S.ui.error = "A group needs a title.";
    scheduleRender();
    return;
  }
  const ok = await run("rename this group", () => S.caps.db.doc(`groups/${gid}`).update({ title }));
  if (ok) {
    clearDraft(`rename-${gid}`);
    S.ui.renaming = null;
  }
}

async function mergeGroup(fromId, intoId) {
  if (!intoId || intoId === fromId) return;
  const { db } = S.caps;
  await run("merge these groups", async () => {
    for (const it of S.data.items.filter((x) => x.groupId === fromId)) await db.doc(`items/${it.id}`).update({ groupId: intoId });
    await db.doc(`groups/${fromId}`).delete();
  });
}

async function deleteGroup(gid) {
  S.ui.confirm = null;
  await run("delete this group", () => S.caps.db.doc(`groups/${gid}`).delete());
}

// ---------- voting ----------

async function vote(retro, groupId, delta) {
  const { db } = S.caps;
  if (!S.me.id || S.ui.busy) return;
  S.ui.busy = "vote";
  scheduleRender();
  try {
    if (delta > 0) {
      if (!canVote(liveMyBallots())) return;
      const bid = newId("b");
      await db.doc(`ballots/${bid}`).set({ retroId: retro.id, groupId });
      S.data.mine.ballots = [...S.data.mine.ballots, bid];
    } else {
      const mine = myBallotsIn(groupId);
      if (!mine.length) return;
      const bid = mine[mine.length - 1];
      await db.doc(`ballots/${bid}`).delete();
      S.data.mine.ballots = S.data.mine.ballots.filter((x) => x !== bid);
    }
    await saveMine(retro.id);
    setPresence({ rid: retro.id, votesUsed: S.data.mine.ballots.length });
    S.ui.error = null;
  } catch (e) {
    fail(e, "vote");
  } finally {
    S.ui.busy = null;
    scheduleRender();
  }
}

// ---------- actions ----------

async function addAction(retro, gid) {
  const textId = `act-${gid}`;
  const text = cleanCardText(S.drafts[textId]);
  const ownerId = S.ui.owner[gid];
  if (!text || !ownerId) {
    S.ui.error = !text ? "Write what the action is." : "Pick an owner for this action.";
    S.ui.invalid = !text ? textId : `owner-${gid}`;
    scheduleRender();
    return;
  }
  const aid = newId("a");
  const ok = await run("add this action", () =>
    S.caps.db.doc(`actions/${aid}`).set({ retroId: retro.id, groupId: gid, text, ownerId, done: false, createdAt: Date.now() })
  );
  if (ok) {
    clearDraft(textId);
    delete S.ui.owner[gid];
    S.ui.invalid = null;
  }
}

async function saveActionEdit(aid) {
  const text = cleanCardText(S.drafts[`edit-act-${aid}`]);
  const ownerId = S.ui.owner[`edit-${aid}`];
  if (!text || !ownerId) {
    S.ui.error = !text ? "Write what the action is." : "Pick an owner for this action.";
    scheduleRender();
    return;
  }
  const ok = await run("edit this action", () => S.caps.db.doc(`actions/${aid}`).update({ text, ownerId }));
  if (ok) {
    clearDraft(`edit-act-${aid}`);
    delete S.ui.owner[`edit-${aid}`];
    S.ui.editing = null;
  }
}

async function toggleDone(a, done) {
  await run("update this action", () => S.caps.db.doc(`actions/${a.id}`).update({ done }));
}

async function deleteAction(aid) {
  S.ui.confirm = null;
  await run("delete this action", () => S.caps.db.doc(`actions/${aid}`).delete());
}

async function deleteRetro(retro) {
  const { db } = S.caps;
  S.ui.confirm = null;
  const ok = await run("delete this retro", async () => {
    for (const col of ["items", "groups", "ballots", "actions"]) {
      for (const d of S.data[col]) await db.doc(`${col}/${d.id}`).delete();
    }
    await db.doc(`retros/${retro.id}`).delete();
  });
  if (ok) location.hash = "history";
}

// ---------- subscriptions ----------

function snapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function onDbError(e) {
  fail(e, "load the board");
}

function ensureSubscriptions() {
  const { db } = S.caps;
  if (!db) return;
  const retro = currentRetro();
  const rid = retro?.id || (S.route.view === "retro" ? S.route.rid : null);
  if (rid !== S.subRid) {
    unsubRetro.forEach((u) => u());
    unsubRetro = [];
    S.subRid = rid;
    S.data = emptyData();
    S.ui.selected = new Set();
    S.ui.editing = null;
    S.ui.confirm = null;
    if (rid) {
      for (const col of ["items", "groups", "ballots", "actions"]) {
        const q = db.collection(col).where("retroId", "==", rid);
        unsubRetro.push(
          q.onSnapshot((snap) => {
            if (S.subRid !== rid) return;
            let docs = snapDocs(snap);
            if (col === "items" || col === "actions") docs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            if (col === "groups") docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            S.data[col] = docs;
            S.data.loaded[col] = true;
            if (col === "actions") resolveProfiles();
            scheduleRender();
          }, onDbError)
        );
      }
      if (S.me.id) {
        unsubRetro.push(
          db.doc(`data/users/${S.me.id}/${rid}`).onSnapshot((snap) => {
            if (S.subRid !== rid || snap.metadata.hasPendingWrites) return;
            const d = snap.exists ? snap.data() : {};
            S.data.mine = { items: Array.isArray(d.items) ? d.items : [], ballots: Array.isArray(d.ballots) ? d.ballots : [] };
            scheduleRender();
          }, () => {})
        );
      }
      setPresence({ rid, typing: false });
    }
  }
  const prev = retro ? previousRetro(S.retros, retro) : null;
  const prevRid = prev?.id || null;
  if (prevRid !== S.prevRid) {
    if (unsubPrev) unsubPrev();
    unsubPrev = null;
    S.prevRid = prevRid;
    S.prevActions = [];
    if (prevRid) {
      unsubPrev = db.collection("actions").where("retroId", "==", prevRid).onSnapshot((snap) => {
        S.prevActions = snapDocs(snap).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        resolveProfiles();
        scheduleRender();
      }, onDbError);
    }
  }
}

function parseRoute() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (hash === "history") S.route = { view: "history", rid: null };
  else if (hash.startsWith("retro-")) S.route = { view: "retro", rid: hash.slice(6) };
  else S.route = { view: "auto", rid: null };
}

// ---------- rendering ----------

let renderQueued = false;
let restoringFocus = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (S.ui.dragId) return;
    render();
  });
}

function render() {
  const active = document.activeElement;
  const focusId = active && active.id;
  let sel = null;
  if (focusId && typeof active.selectionStart === "number") sel = [active.selectionStart, active.selectionEnd];

  const retro = currentRetro();
  renderTopbar(retro);
  const main = document.getElementById("app");
  main.replaceChildren(...renderMain(retro));
  renderHostbar(retro);

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el && el !== active) {
      restoringFocus = true;
      el.focus({ preventScroll: true });
      restoringFocus = false;
      if (sel && el.setSelectionRange) {
        try {
          el.setSelectionRange(sel[0], sel[1]);
        } catch {}
      }
    }
  }
}

function renderTopbar(retro) {
  const title = document.getElementById("topbar-title");
  const stepper = document.getElementById("stepper");
  const people = document.getElementById("people");
  if (retro) {
    title.replaceChildren(h("span", { class: "crumb__name", text: retro.title }), h("span", { class: "crumb__phase", text: retro.phase === "done" ? "Finished retro" : `${PHASE_LABELS[retro.phase]} phase` }));
    const at = PHASES.indexOf(retro.phase);
    stepper.replaceChildren(
      ...PHASES.map((p, i) =>
        h("li", { "aria-current": i === at ? "step" : null, class: i < at ? "is-past" : null }, PHASE_LABELS[p])
      )
    );
    stepper.hidden = false;
  } else {
    title.replaceChildren(h("span", { class: "crumb__name", text: "Team retros" }), h("span", { class: "crumb__phase", text: "Start, Stop, Continue" }));
    stepper.hidden = true;
  }
  const here = S.caps.room && !S.roomDown ? peopleHere(retro?.id) : [];
  const showVotes = retro?.phase === "vote";
  const shown = here.slice(0, 10);
  people.replaceChildren(
    ...shown.map((p) => {
      const pr = profile(p.by);
      const nm = p.by ? (p.by === S.me.id ? "You" : pr.name || "Someone") : "Someone";
      const done = showVotes && (p.presence?.votesUsed || 0) >= VOTE_BUDGET;
      const label = done ? `${nm}, done voting` : nm;
      return h("span", { class: `avatar${done ? " avatar--done" : ""}`, title: label, role: "img", "aria-label": label }, pr.avatarUrl ? h("img", { src: pr.avatarUrl, alt: "" }) : null);
    }),
    here.length ? h("span", { class: "people__count" }, here.length === 1 ? "1 here" : `${here.length} here`) : null
  );
}

function renderMain(retro) {
  const out = [];
  if (!S.booted) return [loadingState()];
  if (!S.caps.db) {
    return [
      h("div", { class: "empty" },
        h("h2", { text: "Open this board in claude.ai" }),
        h("p", { text: "The retro board keeps its cards and votes in claude.ai. Open it from the artifact link while signed in to your claude.ai account." })
      ),
    ];
  }
  if (S.ui.error) {
    out.push(
      h("div", { class: "notice notice--error", role: "alert" },
        h("div", { class: "notice__row" }, h("span", { text: S.ui.error }), h("button", { type: "button", class: "btn btn--quiet btn--sm", onClick: () => { S.ui.error = null; scheduleRender(); } }, "Dismiss"))
      )
    );
  }
  if (S.me.canWrite === false) {
    out.push(h("p", { class: "notice" }, "You can watch this board. To add cards, vote or write actions, ask the board owner for Contributor access."));
  }
  if (!S.retrosLoaded) return [...out, loadingState()];
  if (!retro) {
    if (S.route.view === "retro") {
      out.push(h("div", { class: "empty" }, h("h2", { text: "This retro isn’t here" }), h("p", { text: "It may have been deleted." }), h("a", { class: "btn", href: "#history" }, "See all retros")));
      return out;
    }
    return [...out, ...renderHistory()];
  }
  const views = { lobby: renderLobby, write: renderWrite, group: renderGroup, vote: renderVote, results: renderResults, actions: renderActions, done: renderDone };
  return [...out, ...views[retro.phase](retro)];
}

function loadingState() {
  return h("div", { class: "columns", "aria-busy": "true", "aria-label": "Loading" },
    ...[0, 1, 2].map(() => h("div", { class: "skeleton", style: "height: 12rem" }))
  );
}

// ----- history -----

function renderHistory() {
  const out = [];
  const host = S.me.isHost;
  out.push(
    h("div", { class: "page-head" },
      h("div", {}, h("h1", { text: "Team retros" }), h("p", { text: "Every retro the team has run, newest first." })),
      host && !S.ui.newRetro ? h("button", { type: "button", class: "btn btn--ink", onClick: () => { S.ui.newRetro = true; scheduleRender(); } }, icon("plus"), "New retro") : null
    )
  );
  if (host && S.ui.newRetro) {
    out.push(
      h("form", { class: "stock panel", onSubmit: (e) => { e.preventDefault(); createRetro(); } },
        h("label", { for: "new-retro-title" }, "Retro name"),
        h("div", { class: "field-row" },
          field("new-retro-title", "input", { placeholder: defaultRetroTitle(), autocomplete: "off" }),
          h("button", { type: "submit", class: "btn btn--ink" }, "Open lobby"),
          h("button", { type: "button", class: "btn btn--quiet", onClick: () => { S.ui.newRetro = false; scheduleRender(); } }, "Cancel")
        )
      )
    );
  }
  const list = [...S.retros].sort((a, b) => b.createdAt - a.createdAt);
  if (!list.length) {
    out.push(
      h("div", { class: "empty stock" },
        h("h2", { text: "No retros yet" }),
        h("p", { text: host ? "Start the first one. The team joins the lobby, then you open the Start, Stop and Continue columns." : "A host starts the first retro. It will open here for everyone." })
      )
    );
    return out;
  }
  const open = {};
  for (const a of S.openActions) open[a.retroId] = (open[a.retroId] || 0) + 1;
  out.push(
    h("ul", { class: "retro-list" },
      ...list.map((r) => {
        const live = r.phase !== "done";
        const top = r.summary?.topGroups || [];
        const date = new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        return h("li", {},
          h("a", { class: "stock retro-row", href: `#retro-${r.id}` },
            h("span", { class: "retro-row__title", text: r.title }),
            h("span", { class: `status${live ? " status--live" : ""}` }, live ? `Live, ${PHASE_LABELS[r.phase].toLowerCase()}` : "Done"),
            h("span", { class: "retro-row__meta" },
              h("span", {}, date),
              r.participants ? h("span", {}, r.participants === 1 ? "1 person" : `${r.participants} people`) : null,
              top.length ? h("span", {}, `Top: ${top.map((t) => `${t.title} (${t.votes})`).join(", ")}`) : null,
              open[r.id] ? h("span", {}, open[r.id] === 1 ? "1 open action" : `${open[r.id]} open actions`) : null
            )
          )
        );
      })
    )
  );
  return out;
}

// ----- lobby -----

function renderLobby(retro) {
  const here = S.caps.room && !S.roomDown ? peopleHere(retro.id) : null;
  const out = [
    h("div", { class: "page-head" },
      h("div", {}, h("h1", { text: "Lobby" }), h("p", { text: S.me.isHost ? "When everyone is here, start the writing phase." : "The host opens the board when everyone is here." }))
    ),
  ];
  out.push(
    h("section", { class: "stock panel", "aria-labelledby": "here-h" },
      h("h2", { id: "here-h", text: "Who’s here" }),
      here == null
        ? h("p", { class: "muted", text: "Live presence isn’t available in this view. The retro still works." })
        : here.length
          ? h("ul", { class: "cards", style: "grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr))" },
              ...here.map((p) => {
                const pr = profile(p.by);
                return h("li", { class: "owner" }, h("span", { class: "avatar" }, pr.avatarUrl ? h("img", { src: pr.avatarUrl, alt: "" }) : null), p.by === S.me.id ? "You" : pr.name || "Someone");
              })
            )
          : h("p", { class: "muted", text: "Waiting for people to open the board." })
    )
  );
  const prev = previousRetro(S.retros, retro);
  if (prev) {
    const { done, total } = actionProgress(S.prevActions);
    out.push(
      h("section", { class: "stock panel", "aria-labelledby": "prev-h" },
        h("div", { class: "page-head" },
          h("h2", { id: "prev-h", text: `Actions from ${prev.title}` }),
          total ? h("span", { class: "status" }, `${done} of ${total} done`) : null
        ),
        total
          ? h("ul", { class: "actions-list" }, ...S.prevActions.map((a) => actionRow(a, { editable: false })))
          : h("p", { class: "muted", text: "The last retro didn’t record any actions." })
      )
    );
  }
  return out;
}

// ----- write -----

function renderWrite(retro) {
  const writing = (S.caps.room && !S.roomDown ? peopleHere(retro.id) : []).filter((p) => p.presence?.typing).length;
  const out = [
    h("div", { class: "page-head" },
      h("div", {}, h("h1", { text: "Write your cards" }), h("p", { text: "Cards are anonymous. Add as many as you like; you can edit or delete your own." })),
      h("p", { class: "writing", "aria-live": "polite" }, writing ? (writing === 1 ? "1 person writing" : `${writing} people writing`) : "")
    ),
  ];
  const loaded = S.data.loaded.items;
  out.push(
    h("div", { class: "columns" },
      ...COLUMNS.map((c) => {
        const cards = S.data.items.filter((it) => it.col === c.id);
        const inputId = `new-${c.id}`;
        return h("section", { class: "column", "aria-labelledby": `col-${c.id}` },
          h("div", { class: "column__head" }, h("h2", { id: `col-${c.id}`, text: c.label }), h("span", { class: "fig muted small" }, String(cards.length))),
          h("p", { class: "small muted", text: c.hint }),
          canWrite()
            ? h("form", { onSubmit: (e) => { e.preventDefault(); addCard(retro, c.id); } },
                h("label", { class: "visually-hidden", for: inputId }, `New ${c.label} card`),
                field(inputId, "textarea", {
                  rows: 2,
                  maxlength: MAX_CARD_LENGTH,
                  placeholder: `Add a ${c.label} card`,
                  onInput: () => markTyping(retro.id),
                  onKeydown: (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); addCard(retro, c.id); } },
                }),
                h("div", { class: "toolbar", style: "margin-top: var(--space-xs)" },
                  h("button", { type: "submit", class: "btn btn--sm" }, icon("plus"), "Add card"),
                  h("span", { class: "small muted" }, "Enter to add, Shift+Enter for a new line")
                )
              )
            : null,
          !loaded
            ? h("div", { class: "skeleton", style: "height: 4rem" })
            : cards.length
              ? h("ul", { class: "cards" }, ...cards.map((it) => cardView(retro, it, { ownEditable: true })))
              : h("p", { class: "small muted", text: "No cards yet." })
        );
      })
    )
  );
  return out;
}

function cardView(retro, it, { ownEditable = false, hostEditable = false, showCol = false, movable = false } = {}) {
  const mine = S.data.mine.items.includes(it.id);
  const editable = (ownEditable && mine && canWrite()) || hostEditable;
  if (S.ui.editing === it.id && editable) {
    const id = `edit-${it.id}`;
    if (S.drafts[id] === undefined) S.drafts[id] = it.text;
    return h("li", { class: "stock card" },
      h("form", { onSubmit: (e) => { e.preventDefault(); saveCardEdit(it.id); } },
        h("label", { class: "visually-hidden", for: id }, "Card text"),
        field(id, "textarea", { rows: 3, maxlength: MAX_CARD_LENGTH }),
        h("div", { class: "toolbar", style: "margin-top: var(--space-xs)" },
          h("button", { type: "submit", class: "btn btn--sm btn--ink" }, "Save"),
          h("button", { type: "button", class: "btn btn--sm btn--quiet", onClick: () => { S.ui.editing = null; clearDraft(id); scheduleRender(); } }, "Cancel")
        )
      )
    );
  }
  const confirming = S.ui.confirm?.kind === "card" && S.ui.confirm.id === it.id;
  const selectable = movable;
  return h("li", {
      class: `stock card${mine ? " card--mine" : ""}`,
      draggable: movable ? "true" : null,
      onDragstart: movable ? (e) => { S.ui.dragId = it.id; e.dataTransfer.setData("text/plain", it.id); e.dataTransfer.effectAllowed = "move"; } : null,
      onDragend: movable ? () => { S.ui.dragId = null; scheduleRender(); } : null,
    },
    h("p", { class: "card__text", text: it.text }),
    confirming
      ? h("div", { class: "confirm" },
          h("span", { class: "small", text: "Delete this card?" }),
          h("button", { type: "button", class: "btn btn--sm btn--danger", onClick: () => deleteCard(retro, it.id) }, "Delete"),
          h("button", { type: "button", class: "btn btn--sm btn--quiet", onClick: () => { S.ui.confirm = null; scheduleRender(); } }, "Keep")
        )
      : h("div", { class: "card__foot" },
          h("span", { class: "col-tag" }, showCol ? COLUMNS.find((c) => c.id === it.col)?.label : mine ? "Yours" : ""),
          h("span", { class: "card__actions" },
            selectable ? selectBox(it) : null,
            movable ? moveSelect(it) : null,
            editable ? iconBtn("edit", "Edit card", () => { S.ui.editing = it.id; scheduleRender(); }) : null,
            editable ? iconBtn("trash", "Delete card", () => { S.ui.confirm = { kind: "card", id: it.id }; scheduleRender(); }) : null
          )
        )
  );
}

function selectBox(it) {
  const id = `sel-${it.id}`;
  return h("label", { title: "Select for a new group", style: "display:inline-flex;align-items:center;min-height:32px" },
    h("input", {
      type: "checkbox",
      id,
      class: "check",
      "aria-label": "Select card for a new group",
      checked: S.ui.selected.has(it.id),
      onChange: (e) => { e.target.checked ? S.ui.selected.add(it.id) : S.ui.selected.delete(it.id); scheduleRender(); },
    })
  );
}

function moveSelect(it) {
  const id = `move-${it.id}`;
  return h("select", {
      id,
      class: "select",
      style: "min-height: 32px; width: auto; max-width: 11rem; padding-block: 0",
      "aria-label": "Move card to group",
      value: it.groupId && S.data.groups.some((g) => g.id === it.groupId) ? it.groupId : "",
      onChange: (e) => moveCard(it.id, e.target.value),
    },
    h("option", { value: "" }, "Ungrouped"),
    ...S.data.groups.map((g) => h("option", { value: g.id }, g.title))
  );
}

// ----- group -----

function renderGroup(retro) {
  const host = S.me.isHost;
  const { items, groups } = S.data;
  const groupingLive = S.ui.grouping || !isGroupingStale(retro.groupingAt);
  const loose = ungroupedItems(items, groups);
  const out = [
    h("div", { class: "page-head" },
      h("div", {},
        h("h1", { text: "Group the cards" }),
        h("p", { text: host ? "Let Claude group the cards by meaning, then move, rename or merge until the themes read right." : "The host is grouping the cards into themes. Watch them form here." })
      )
    ),
  ];
  if (host) {
    const confirmRegroup = S.ui.confirm?.kind === "regroup";
    out.push(
      h("div", { class: "toolbar" },
        h("button", {
            type: "button",
            class: "btn btn--ink",
            disabled: groupingLive || !items.length || !S.caps.sample,
            onClick: () => {
              if (groups.length) S.ui.confirm = { kind: "regroup" };
              else groupWithAI(retro);
              scheduleRender();
            },
          },
          groups.length ? "Regroup with AI" : "Group with AI"
        ),
        h("button", { type: "button", class: "btn", disabled: groupingLive, onClick: () => newGroup(retro, [...S.ui.selected]) },
          S.ui.selected.size ? `New group from ${S.ui.selected.size} selected` : "New empty group"
        ),
        !S.caps.sample ? h("span", { class: "small muted" }, "AI grouping isn’t available in this view. Group the cards by hand.") : null,
        items.length > 150 ? h("span", { class: "small muted" }, `${items.length} cards is a lot for one pass. Expect some hand fixing.`) : null
      )
    );
    if (confirmRegroup) {
      out.push(
        h("div", { class: "confirm", role: "alert" },
          h("span", { text: "Regrouping replaces every group, including your changes." }),
          h("button", { type: "button", class: "btn btn--sm btn--ink", onClick: () => groupWithAI(retro) }, "Regroup"),
          h("button", { type: "button", class: "btn btn--sm btn--quiet", onClick: () => { S.ui.confirm = null; scheduleRender(); } }, "Keep my groups")
        )
      );
    }
  }
  if (groupingLive) {
    out.push(
      h("div", { class: "stock panel", role: "status" },
        h("p", { text: `Claude is grouping ${items.length} cards by meaning.` }),
        h("div", { class: "progress-line" }, h("span"))
      )
    );
  }
  if (!S.data.loaded.items || !S.data.loaded.groups) return [...out, loadingState()];
  if (!items.length) {
    out.push(h("div", { class: "empty stock" }, h("h2", { text: "No cards to group" }), h("p", { text: host ? "Go back to the writing phase to collect cards." : "No one added cards in this retro." })));
    return out;
  }
  const canEditCards = host && !groupingLive;
  if (loose.length) {
    out.push(
      h("section", {
          class: `loose${S.ui.highlightLoose ? " is-highlight" : ""}`,
          "aria-labelledby": "loose-h",
          ...dropZone(null, canEditCards),
        },
        h("h2", { id: "loose-h", text: loose.length === 1 ? "1 ungrouped card" : `${loose.length} ungrouped cards` }),
        h("ul", { class: "cards" }, ...loose.map((it) => cardView(retro, it, { hostEditable: canEditCards, showCol: true, movable: canEditCards })))
      )
    );
  }
  if (groups.length) {
    out.push(h("div", { class: "groups" }, ...groups.map((g) => groupView(retro, g, canEditCards))));
  } else if (!groupingLive) {
    out.push(h("p", { class: "muted", text: host ? "No groups yet. Use Group with AI, or select cards and make a group." : "No groups yet." }));
  }
  return out;
}

function dropZone(gid, enabled) {
  if (!enabled) return {};
  return {
    onDragover: (e) => { e.preventDefault(); e.currentTarget.classList.add("is-drop"); },
    onDragleave: (e) => e.currentTarget.classList.remove("is-drop"),
    onDrop: (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove("is-drop");
      const iid = e.dataTransfer.getData("text/plain") || S.ui.dragId;
      S.ui.dragId = null;
      if (iid) moveCard(iid, gid);
    },
  };
}

function groupView(retro, g, editable) {
  const cards = S.data.items.filter((it) => it.groupId === g.id);
  const renaming = S.ui.renaming === g.id && editable;
  const rid = `rename-${g.id}`;
  if (renaming && S.drafts[rid] === undefined) S.drafts[rid] = g.title;
  const others = S.data.groups.filter((x) => x.id !== g.id);
  return h("section", { class: "stock group", "aria-label": g.title, ...dropZone(g.id, editable) },
    renaming
      ? h("form", { class: "field-row", onSubmit: (e) => { e.preventDefault(); renameGroup(g.id); } },
          h("label", { class: "visually-hidden", for: rid }, "Group title"),
          field(rid, "input", { maxlength: 80, autocomplete: "off" }),
          h("button", { type: "submit", class: "btn btn--sm btn--ink" }, "Save"),
          h("button", { type: "button", class: "btn btn--sm btn--quiet", onClick: () => { S.ui.renaming = null; clearDraft(rid); scheduleRender(); } }, "Cancel")
        )
      : h("div", { class: "group__head" },
          h("h3", { text: g.title }),
          h("span", { class: "fig small muted" }, String(cards.length)),
          editable ? iconBtn("edit", `Rename ${g.title}`, () => { S.ui.renaming = g.id; scheduleRender(); }) : null
        ),
    cards.length
      ? h("ul", { class: "cards" }, ...cards.map((it) => cardView(retro, it, { hostEditable: editable, showCol: true, movable: editable })))
      : h("p", { class: "small muted", text: editable ? "Empty. Drag cards here or use a card’s group menu." : "Empty." }),
    editable
      ? h("div", { class: "group__tools" },
          others.length
            ? h("select", {
                  id: `merge-${g.id}`,
                  class: "select",
                  style: "min-height: 32px; width: auto; padding-block: 0",
                  "aria-label": `Merge ${g.title} into another group`,
                  value: "",
                  onChange: (e) => mergeGroup(g.id, e.target.value),
                },
                h("option", { value: "" }, "Merge into..."),
                ...others.map((o) => h("option", { value: o.id }, o.title))
              )
            : null,
          !cards.length ? h("button", { type: "button", class: "btn btn--sm btn--quiet btn--danger", onClick: () => deleteGroup(g.id) }, "Delete group") : null
        )
      : null
  );
}

// ----- vote -----

function renderVote(retro) {
  const used = liveMyBallots().length;
  const left = votesLeft(liveMyBallots());
  const writable = canWrite() && !!S.me.id;
  const out = [
    h("div", { class: "page-head" },
      h("div", {}, h("h1", { text: "Vote on the themes" }), h("p", { text: "Votes are anonymous and stay hidden until the host reveals them. You can put more than one on a theme." })),
      writable
        ? h("div", { class: "budget", role: "status", "aria-live": "polite" },
            h("span", { class: "budget__dots", "aria-hidden": "true" }, ...Array.from({ length: VOTE_BUDGET }, (_, i) => h("span", { class: `dot${i < used ? " is-spent" : ""}` }))),
            h("strong", {}, left === 1 ? "1 vote left" : `${left} votes left`)
          )
        : null
    ),
  ];
  if (!S.me.id && canWrite()) out.push(h("p", { class: "notice" }, "Voting needs a signed-in account so your votes can be counted once."));
  if (!S.data.loaded.groups || !S.data.loaded.ballots) return [...out, loadingState()];
  out.push(
    h("div", { class: "groups" },
      ...S.data.groups.map((g) => {
        const cards = S.data.items.filter((it) => it.groupId === g.id);
        const mine = myBallotsIn(g.id).length;
        return h("section", { class: "stock group", "aria-label": g.title },
          h("div", { class: "group__head" },
            h("h3", { text: g.title }),
            writable
              ? h("div", { class: "voter" },
                  h("button", { type: "button", class: "btn btn--sm icon-btn", "aria-label": `Remove a vote from ${g.title}`, disabled: !mine || !!S.ui.busy, onClick: () => vote(retro, g.id, -1) }, icon("minus")),
                  h("output", { "aria-label": `Your votes on ${g.title}` }, String(mine)),
                  h("button", { type: "button", class: "btn btn--sm icon-btn", "aria-label": `Add a vote to ${g.title}`, disabled: !left || !!S.ui.busy, onClick: () => vote(retro, g.id, 1) }, icon("plus"))
                )
              : null
          ),
          h("ul", { class: "cards" }, ...cards.map((it) => h("li", { class: "card" }, h("p", { class: "card__text", text: it.text }), h("span", { class: "col-tag" }, COLUMNS.find((c) => c.id === it.col)?.label))))
        );
      })
    )
  );
  return out;
}

// ----- results -----

function rankedBoard(withActions = false) {
  const ranked = ranking(S.data.groups, S.data.items, S.data.ballots);
  return h("div", { class: "ranked-wrap" },
    h("ol", { class: "ranked" },
      ...ranked.map((g) =>
        h("li", { class: "rank" },
          h("div", { class: "rank__votes", "aria-label": `${g.votes} votes` }, h("span", { class: "fig" }, String(g.votes)), h("span", {}, g.votes === 1 ? "vote" : "votes")),
          h("div", { class: "rank__body" },
            h("h2", { text: g.title }),
            h("ul", { class: "rank__list" },
              ...g.cards.map((it) => h("li", {}, h("span", { class: "col-tag" }, COLUMNS.find((c) => c.id === it.col)?.label), it.text))
            ),
            withActions ? withActions(g) : null
          )
        )
      )
    )
  );
}

function renderResults() {
  if (!S.data.loaded.groups || !S.data.loaded.ballots || !S.data.loaded.items) return [loadingState()];
  const total = S.data.ballots.length;
  return [
    h("div", { class: "page-head" },
      h("div", {}, h("h1", { text: "What the team chose" }), h("p", { text: "Themes ranked by votes, with every card under them." })),
      h("span", { class: "status" }, h("span", { class: "fig" }, String(total)), " votes cast")
    ),
    rankedBoard(),
  ];
}

// ----- actions -----

function ownerChip(id) {
  const pr = profile(id);
  return h("span", { class: "owner" }, h("span", { class: "avatar" }, pr.avatarUrl ? h("img", { src: pr.avatarUrl, alt: "" }) : null), nameOf(id));
}

function ownerPicker(key, label) {
  const chosen = S.ui.owner[key];
  const inputId = `owner-${key}`;
  if (chosen) {
    return h("div", { class: "toolbar" },
      ownerChip(chosen),
      h("button", { type: "button", class: "btn btn--sm btn--quiet", onClick: () => { delete S.ui.owner[key]; S.ui.pickerOpen = key; scheduleRender(); } }, "Change")
    );
  }
  const hits = S.ui.hits[key] || [];
  const search = async (q) => {
    if (!S.caps.user) return;
    const res = await S.caps.user.search(q);
    S.ui.hits[key] = res;
    scheduleRender();
  };
  return h("div", { class: "picker" },
    h("label", { class: "visually-hidden", for: inputId }, label),
    field(inputId, "input", {
      placeholder: "Owner: search the team",
      autocomplete: "off",
      role: "combobox",
      "aria-expanded": S.ui.pickerOpen === key && hits.length ? "true" : "false",
      "aria-controls": `menu-${key}`,
      "aria-invalid": S.ui.invalid === inputId ? "true" : null,
      onFocus: (e) => { if (restoringFocus) return; S.ui.pickerOpen = key; search(e.target.value || ""); },
      onInput: (e) => { S.ui.pickerOpen = key; search(e.target.value); },
      onKeydown: (e) => { if (e.key === "Escape") { S.ui.pickerOpen = null; scheduleRender(); } },
    }),
    S.ui.pickerOpen === key && hits.length
      ? h("ul", { class: "stock picker__menu", id: `menu-${key}`, role: "listbox" },
          ...hits.map((p) =>
            h("li", { role: "option" },
              h("button", {
                  type: "button",
                  onClick: () => {
                    S.ui.owner[key] = p.id;
                    S.profiles[p.id] = p;
                    S.ui.pickerOpen = null;
                    clearDraft(inputId);
                    if (S.ui.invalid === inputId) S.ui.invalid = null;
                    scheduleRender();
                  },
                },
                h("span", { class: "avatar", style: "width:24px;height:24px" }, h("img", { src: p.avatarUrl, alt: "" })),
                p.isMe ? `${p.name} (you)` : p.name
              )
            )
          )
        )
      : null
  );
}

function actionRow(a, { editable }) {
  const canToggle = canWrite() && (S.me.isHost || (S.me.id && a.ownerId === S.me.id));
  if (editable && S.ui.editing === `act-${a.id}`) {
    const tid = `edit-act-${a.id}`;
    if (S.drafts[tid] === undefined) S.drafts[tid] = a.text;
    if (!(`edit-${a.id}` in S.ui.owner)) S.ui.owner[`edit-${a.id}`] = a.ownerId;
    return h("li", { class: "action", style: "grid-template-columns: minmax(0, 1fr)" },
      h("form", { class: "action-form", onSubmit: (e) => { e.preventDefault(); saveActionEdit(a.id); } },
        h("div", {}, h("label", { class: "visually-hidden", for: tid }, "Action"), field(tid, "input", { maxlength: MAX_CARD_LENGTH, autocomplete: "off" })),
        ownerPicker(`edit-${a.id}`, "Action owner"),
        h("div", { class: "toolbar" },
          h("button", { type: "submit", class: "btn btn--sm btn--ink" }, "Save"),
          h("button", { type: "button", class: "btn btn--sm btn--quiet", onClick: () => { S.ui.editing = null; clearDraft(tid); delete S.ui.owner[`edit-${a.id}`]; scheduleRender(); } }, "Cancel")
        )
      )
    );
  }
  const confirming = S.ui.confirm?.kind === "action" && S.ui.confirm.id === a.id;
  return h("li", { class: `action${a.done ? " is-done" : ""}` },
    h("input", {
      type: "checkbox",
      class: "check",
      id: `done-${a.id}`,
      checked: !!a.done,
      disabled: !canToggle,
      "aria-label": a.done ? "Mark not done" : "Mark done",
      title: canToggle ? null : "Only the owner or a host can tick this",
      onChange: (e) => toggleDone(a, e.target.checked),
    }),
    h("div", { style: "display:grid;gap:2px;min-width:0" },
      h("span", { class: "action__text", text: a.text }),
      h("span", { class: "toolbar" }, ownerChip(a.ownerId), a.done ? h("span", { class: "stamp" }, "Done") : null)
    ),
    confirming
      ? h("span", { class: "toolbar" },
          h("button", { type: "button", class: "btn btn--sm btn--danger", onClick: () => deleteAction(a.id) }, "Delete"),
          h("button", { type: "button", class: "btn btn--sm btn--quiet", onClick: () => { S.ui.confirm = null; scheduleRender(); } }, "Keep")
        )
      : editable && canWrite()
        ? h("span", { class: "card__actions" },
            iconBtn("edit", "Edit action", () => { S.ui.editing = `act-${a.id}`; scheduleRender(); }),
            iconBtn("trash", "Delete action", () => { S.ui.confirm = { kind: "action", id: a.id }; scheduleRender(); })
          )
        : h("span")
  );
}

function renderActions(retro) {
  if (!S.data.loaded.groups || !S.data.loaded.actions) return [loadingState()];
  const writable = canWrite();
  return [
    h("div", { class: "page-head" },
      h("div", {}, h("h1", { text: "Agree the actions" }), h("p", { text: "Anyone can add an action under a theme. Every action needs an owner." }))
    ),
    rankedBoard((g) => {
      const acts = S.data.actions.filter((a) => a.groupId === g.id);
      const tid = `act-${g.id}`;
      return h("div", { style: "display:grid;gap:var(--space-sm);margin-top:var(--space-xs)" },
        h("h3", { text: acts.length ? "Actions" : "No actions yet" }),
        acts.length ? h("ul", { class: "actions-list" }, ...acts.map((a) => actionRow(a, { editable: true }))) : null,
        writable
          ? h("form", { class: "action-form", onSubmit: (e) => { e.preventDefault(); addAction(retro, g.id); } },
              h("div", {},
                h("label", { class: "visually-hidden", for: tid }, `New action for ${g.title}`),
                field(tid, "input", { placeholder: "What will we do?", maxlength: MAX_CARD_LENGTH, autocomplete: "off", "aria-invalid": S.ui.invalid === tid ? "true" : null })
              ),
              ownerPicker(g.id, `Owner for the new action on ${g.title}`),
              h("button", { type: "submit", class: "btn btn--ink" }, "Add action")
            )
          : null
      );
    }),
  ];
}

// ----- done -----

function renderDone(retro) {
  if (!S.data.loaded.groups || !S.data.loaded.actions || !S.data.loaded.ballots) return [loadingState()];
  const { done, total } = actionProgress(S.data.actions);
  const out = [
    h("div", { class: "page-head" },
      h("div", {},
        h("h1", { text: retro.title }),
        h("p", { text: `Finished ${new Date(retro.finishedAt || retro.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.` })
      ),
      total ? h("span", { class: "status" }, `${done} of ${total} actions done`) : null
    ),
    rankedBoard((g) => {
      const acts = S.data.actions.filter((a) => a.groupId === g.id);
      return acts.length ? h("ul", { class: "actions-list", style: "margin-top: var(--space-xs)" }, ...acts.map((a) => actionRow(a, { editable: false }))) : null;
    }),
  ];
  if (S.me.isHost) {
    const confirming = S.ui.confirm?.kind === "retro";
    out.push(
      confirming
        ? h("div", { class: "confirm", role: "alert" },
            h("span", { text: "Delete this retro and all its cards, votes and actions? This can’t be undone." }),
            h("button", { type: "button", class: "btn btn--sm btn--danger", onClick: () => deleteRetro(retro) }, "Delete retro"),
            h("button", { type: "button", class: "btn btn--sm btn--quiet", onClick: () => { S.ui.confirm = null; scheduleRender(); } }, "Keep it")
          )
        : h("div", { class: "toolbar" },
            h("a", { class: "btn", href: "#history" }, "All retros"),
            h("button", { type: "button", class: "btn btn--quiet btn--danger", onClick: () => { S.ui.confirm = { kind: "retro" }; scheduleRender(); } }, "Delete this retro")
          )
    );
  }
  return out;
}

// ----- host bar -----

const ADVANCE_LABELS = {
  lobby: "Start writing",
  write: "Start grouping",
  group: "Start voting",
  vote: "Reveal votes",
  results: "Write actions",
  actions: "Finish retro",
};

const HOST_HINTS = {
  lobby: "Everyone sees the board switch when you start.",
  write: "Cards stay editable until you move on. You can come back.",
  group: "Every card needs a group before voting.",
  vote: "Totals stay hidden until you reveal them.",
  results: "Next, the team writes actions under each theme.",
  actions: "Finishing locks the retro. Owners can still tick actions done.",
};

function renderHostbar(retro) {
  const bar = document.getElementById("hostbar");
  if (!retro || !S.me.isHost || retro.phase === "done" || !S.caps.db) {
    bar.hidden = true;
    document.getElementById("app").style.paddingBottom = "";
    return;
  }
  bar.hidden = false;
  const next = nextPhase(retro.phase);
  const prev = prevPhase(retro.phase);
  const blocker = advanceBlocker(retro.phase, S.data);
  let msg = blocker || HOST_HINTS[retro.phase];
  if (retro.phase === "vote" && S.caps.room && !S.roomDown) {
    const voters = peopleHere(retro.id).filter((p) => (p.presence?.votesUsed || 0) > 0).length;
    const doneVoting = peopleHere(retro.id).filter((p) => (p.presence?.votesUsed || 0) >= VOTE_BUDGET).length;
    if (voters && overBudget(S.data.ballots.length, voters)) msg = `There are more votes than ${voters} voters could cast. Someone may have voted twice.`;
    else msg = `${doneVoting} of ${peopleHere(retro.id).length} people have used all their votes. ${HOST_HINTS.vote}`;
  }
  const finishing = S.ui.confirm?.kind === "finish";
  const grouping = S.ui.grouping || !isGroupingStale(retro.groupingAt);
  bar.replaceChildren(
    h("div", { class: "wrap hostbar__row" },
      h("p", { class: "hostbar__msg", role: "status" }, finishing ? "Finish the retro? Cards, groups, votes and action text lock." : msg),
      h("div", { class: "hostbar__btns" },
        prev && !finishing ? h("button", { type: "button", class: "btn btn--quiet", disabled: grouping, onClick: () => setPhase(retro, prev) }, icon("back"), `Back to ${PHASE_LABELS[prev].toLowerCase()}`) : null,
        finishing ? h("button", { type: "button", class: "btn btn--quiet", onClick: () => { S.ui.confirm = null; scheduleRender(); } }, "Not yet") : null,
        next
          ? h("button", {
                type: "button",
                class: "btn btn--ink",
                disabled: grouping,
                "aria-describedby": null,
                onClick: () => {
                  if (blocker) {
                    if (retro.phase === "group") S.ui.highlightLoose = true;
                    S.ui.error = blocker;
                    scheduleRender();
                    return;
                  }
                  if (next === "done" && !finishing) {
                    S.ui.confirm = { kind: "finish" };
                    scheduleRender();
                    return;
                  }
                  setPhase(retro, next);
                },
              },
              finishing ? "Finish retro" : ADVANCE_LABELS[retro.phase]
            )
          : null
      )
    )
  );
  document.getElementById("app").style.paddingBottom = `${bar.offsetHeight + 24}px`;
}

// ---------- boot ----------

async function boot() {
  parseRoute();
  const use = (name) => (window.claude && typeof window.claude.use === "function" ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
  const [db, user, room, sample] = await Promise.all([use("db"), use("user"), use("room"), use("sample")]);
  S.caps = { db, user, room, sample };
  if (user) {
    const me = await user.me();
    S.me.id = me.id;
    S.me.isHost = !!me.canEdit;
    S.me.canWrite = await user.can("data.write");
  }
  S.booted = true;
  if (!db) {
    render();
    return;
  }
  db.collection("retros").orderBy("createdAt", "desc").limit(300).onSnapshot((snap) => {
    S.retros = snapDocs(snap);
    S.retrosLoaded = true;
    ensureSubscriptions();
    scheduleRender();
  }, onDbError);
  db.collection("actions").where("done", "==", false).onSnapshot((snap) => {
    S.openActions = snapDocs(snap);
    scheduleRender();
  }, () => {});
  if (room) {
    room.onPeers((change) => {
      S.peers = change.peers;
      resolveProfiles();
      scheduleRender();
    }, () => {
      S.roomDown = true;
      scheduleRender();
    });
  }
  window.addEventListener("hashchange", () => {
    parseRoute();
    S.ui.error = null;
    ensureSubscriptions();
    scheduleRender();
  });
  document.addEventListener("click", (e) => {
    if (S.ui.pickerOpen && !e.target.closest(".picker")) {
      S.ui.pickerOpen = null;
      scheduleRender();
    }
  });
  resolveProfiles();
  render();
}

document.getElementById("home-link").addEventListener("click", (e) => {
  e.preventDefault();
  location.hash = "history";
});

boot();
