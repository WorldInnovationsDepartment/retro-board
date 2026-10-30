// In-memory stand-in for the artifact runtime (db, user, room, sample) so the
// real board renders demo scenes in headless Chrome. Data is invented.
(function () {
  const scene = new URLSearchParams(location.search).get("scene") || "write";
  const DAY = 86400000;
  const NOW = Date.UTC(2026, 9, 30, 10, 0);

  const PEOPLE = [
    ["u_me", "Dan Morgan", "#7a4a2a"],
    ["u_sam", "Sam Rivera", "#2f5d62"],
    ["u_priya", "Priya Shah", "#8a3b2e"],
    ["u_tom", "Tom Becker", "#4b4a7a"],
    ["u_ana", "Ana Costa", "#6b5a2a"],
    ["u_lee", "Lee Park", "#3d6b45"],
    ["u_jonas", "Jonas Weber", "#5b3a5e"],
    ["u_maya", "Maya Cohen", "#7a3d4f"],
  ];
  const avatar = (name, color) => {
    const ini = name.split(" ").map((w) => w[0]).join("");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='${color}'/><text x='32' y='41' font-family='Helvetica,Arial' font-size='24' font-weight='600' fill='#fff' text-anchor='middle'>${ini}</text></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  };
  const PROFILES = Object.fromEntries(
    PEOPLE.map(([id, name, color]) => [id, { id, name, avatarUrl: avatar(name, color), color, email: null, isMe: id === "u_me", guest: false }])
  );

  const CARDS = [
    ["c1", "start", "Write acceptance criteria before the sprint starts"],
    ["c2", "start", "Demo work in progress every Friday"],
    ["c3", "start", "Pair on risky migrations"],
    ["c4", "start", "A QA freeze three days before release"],
    ["c5", "start", "Short screen recordings on pull requests"],
    ["c6", "stop", "Changing scope in the middle of the sprint"],
    ["c7", "stop", "Calls booked without an agenda"],
    ["c8", "stop", "Adding tickets after the release is planned"],
    ["c9", "stop", "Starting work with open product questions"],
    ["c10", "stop", "Standups that run 30 minutes"],
    ["c11", "continue", "Fast CI on every pull request"],
    ["c12", "continue", "QA reviewing criteria early"],
    ["c13", "continue", "Sharing AI tricks in the dev channel"],
    ["c14", "continue", "Async updates instead of status calls"],
    ["c15", "continue", "Release notes written by the author"],
    ["c16", "stop", "Last-minute scope requests from sales"],
  ];
  const GROUPS = [
    ["g1", "Scope changes after planning", ["c6", "c8", "c16"]],
    ["g2", "Clear requirements up front", ["c1", "c9"]],
    ["g3", "Meetings that eat focus time", ["c7", "c10", "c14"]],
    ["g4", "Release and QA timing", ["c4", "c11", "c12", "c3"]],
    ["g5", "Sharing how we work", ["c2", "c5", "c13", "c15"]],
  ];
  const VOTES = { g1: 9, g2: 6, g3: 5, g4: 4, g5: 3 };

  const store = new Map();
  const put = (path, data) => store.set(path, { ...data });

  const phaseFor = {
    history: "actions", lobby: "lobby", write: "write", group: "group", grouping: "group",
    grouped: "group", vote: "vote", results: "results", actions: "actions",
  };
  const rid = "rnow";
  put("retros/rold2", { title: "Retro, 2 Oct 2026", createdAt: NOW - 28 * DAY, phase: "done", participants: 11, finishedAt: NOW - 28 * DAY, summary: { topGroups: [{ title: "Flaky end-to-end tests", votes: 8 }, { title: "On-call handover", votes: 5 }] } });
  put("retros/rold", { title: "Retro, 16 Oct 2026", createdAt: NOW - 14 * DAY, phase: "done", participants: 13, finishedAt: NOW - 14 * DAY, summary: { topGroups: [{ title: "Release week crunch", votes: 10 }, { title: "Too many meetings", votes: 6 }] } });
  put(`retros/${rid}`, { title: "Retro, 30 Oct 2026", createdAt: NOW, phase: phaseFor[scene] || "write", participants: 8, groupingAt: scene === "grouping" ? Date.now() : null, summary: null, finishedAt: null });

  [
    ["p1", "Move release-week bug triage to Monday", "u_priya", true],
    ["p2", "One owner per meeting, agenda in the invite", "u_tom", true],
    ["p3", "Cap standup at 15 minutes", "u_sam", false],
  ].forEach(([id, text, ownerId, done], i) => put(`actions/${id}`, { retroId: "rold", groupId: "x", text, ownerId, done, createdAt: NOW - 14 * DAY + i }));
  put("actions/q1", { retroId: "rold2", groupId: "x", text: "Quarantine flaky tests within a day", ownerId: "u_lee", done: false, createdAt: NOW - 28 * DAY });

  const withCards = ["write", "group", "grouping", "grouped", "vote", "results", "actions", "history"].includes(scene);
  if (withCards) {
    const shown = scene === "write" ? CARDS.slice(0, 14) : CARDS;
    shown.forEach(([id, col, text], i) => put(`items/${id}`, { retroId: rid, col, text, groupId: null, createdAt: NOW + i * 1000 }));
  }
  const grouped = ["grouped", "vote", "results", "actions", "history"].includes(scene);
  if (grouped) {
    GROUPS.forEach(([gid, title, ids], order) => {
      put(`groups/${gid}`, { retroId: rid, title, order });
      ids.forEach((iid) => { const it = store.get(`items/${iid}`); if (it) it.groupId = gid; });
    });
  }
  if (["results", "actions", "history"].includes(scene)) {
    let n = 0;
    for (const [gid, count] of Object.entries(VOTES)) for (let i = 0; i < count; i++) put(`ballots/b${n++}`, { retroId: rid, groupId: gid });
  }
  const mine = { items: ["c2", "c9", "c14"], ballots: [] };
  if (scene === "vote") {
    put("ballots/m1", { retroId: rid, groupId: "g1" });
    put("ballots/m2", { retroId: rid, groupId: "g1" });
    mine.ballots = ["m1", "m2"];
  }
  if (scene === "actions") {
    put("actions/a1", { retroId: rid, groupId: "g1", text: "Freeze sprint scope after planning; new asks go to next sprint", ownerId: "u_priya", done: false, createdAt: NOW + 1 });
    put("actions/a2", { retroId: rid, groupId: "g2", text: "Product signs off acceptance criteria before sprint start", ownerId: "u_ana", done: false, createdAt: NOW + 2 });
  }
  put(`data/users/u_me/${rid}`, mine);

  // ----- db -----
  const listeners = new Set();
  const segs = (p) => p.split("/");
  const inCollection = (path, col) => { const s = segs(path); return s.length === segs(col).length + 1 && path.startsWith(col + "/"); };
  const snapDoc = (path) => {
    const d = store.get(path);
    return { id: segs(path).pop(), exists: !!d, data: () => (d ? { ...d } : undefined), metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const notify = () => setTimeout(() => listeners.forEach((fn) => fn()), 0);
  function query(col, filters = [], order = null, lim = null) {
    const run = () => {
      let docs = [...store.keys()].filter((p) => inCollection(p, col)).map(snapDoc);
      for (const [f, op, v] of filters) docs = docs.filter((d) => (op === "==" ? d.data()[f] === v : true));
      if (order) docs.sort((a, b) => (a.data()[order[0]] > b.data()[order[0]] ? 1 : -1) * (order[1] === "desc" ? -1 : 1));
      if (lim) docs = docs.slice(0, lim);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      where: (f, op, v) => query(col, [...filters, [f, op, v]], order, lim),
      orderBy: (f, dir = "asc") => query(col, filters, [f, dir], lim),
      limit: (n) => query(col, filters, order, n),
      get: async () => run(),
      onSnapshot(next) { const fn = () => next(run()); listeners.add(fn); setTimeout(fn, 0); return () => listeners.delete(fn); },
      doc: (id) => docRef(`${col}/${id || Math.random().toString(36).slice(2)}`),
      add: async (data) => { const r = docRef(`${col}/${Math.random().toString(36).slice(2)}`); await r.set(data); return r; },
    };
  }
  function docRef(path) {
    return {
      id: segs(path).pop(), path,
      get: async () => snapDoc(path),
      set: async (data) => { put(path, data); notify(); },
      update: async (data) => { store.set(path, { ...(store.get(path) || {}), ...data }); notify(); },
      delete: async () => { store.delete(path); notify(); },
      onSnapshot(next) { const fn = () => next(snapDoc(path)); listeners.add(fn); setTimeout(fn, 0); return () => listeners.delete(fn); },
      collection: (sub) => query(`${path}/${sub}`),
    };
  }
  const db = { doc: docRef, collection: (c) => query(c) };

  // ----- user -----
  const user = {
    isOwner: async () => true, canEdit: async () => true, can: async () => true,
    id: async () => "u_me",
    me: async () => ({ ...PROFILES.u_me, isOwner: true, canEdit: true }),
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, PROFILES[id] || { id, name: "", avatarUrl: avatar("?", "#888"), color: "#888", email: null, isMe: false, guest: false }])),
    search: async (q) => Object.values(PROFILES).filter((p) => p.name.toLowerCase().includes((q || "").toLowerCase())).slice(0, 6),
  };

  // ----- room -----
  const peers = PEOPLE.map(([id], i) => ({
    peer: "p" + i, by: id, isMe: id === "u_me", sameTab: id === "u_me", kind: "viewer", guest: false, updatedAt: Date.now(),
    presence: {
      rid,
      typing: scene === "write" && ["u_sam", "u_ana", "u_lee", "u_maya"].includes(id),
      votesUsed: scene === "vote" ? (["u_sam", "u_priya", "u_tom", "u_lee"].includes(id) ? 3 : id === "u_me" ? 2 : 1) : 0,
    },
  }));
  const room = {
    presence: async () => {}, emit: async () => {}, on: () => () => {}, peers: () => peers,
    onPeers(fn) { setTimeout(() => fn({ peers, joined: peers, left: [], updated: [] }), 0); return () => {}; },
  };

  const sample = Object.assign(async () => ({ text: "", truncated: false }), {
    json: () => new Promise(() => {}),
    limits: async () => ({ maxPromptBytes: 262144 }),
  });

  const caps = { db, user, room, sample };
  window.claude = { use: (name) => Promise.resolve(caps[name] || null) };
  window.__scene = scene;
})();
