// Pure rules for the retro board. Tested with `node --test`; build.mjs inlines
// this file into the page with its `export` keywords stripped.

export const PHASES = ["lobby", "write", "group", "vote", "results", "actions", "done"];

export const PHASE_LABELS = {
  lobby: "Lobby",
  write: "Write",
  group: "Group",
  vote: "Vote",
  results: "Results",
  actions: "Actions",
  done: "Done",
};

export const COLUMNS = [
  { id: "start", label: "Start", hint: "What should we begin doing?" },
  { id: "stop", label: "Stop", hint: "What is getting in our way?" },
  { id: "continue", label: "Continue", hint: "What is working that we should keep?" },
];

export const VOTE_BUDGET = 3;
export const MAX_CARD_LENGTH = 500;
export const OTHER_GROUP_TITLE = "Other";
export const GROUPING_STALE_MS = 2 * 60 * 1000;

export function nextPhase(phase) {
  const i = PHASES.indexOf(phase);
  return i >= 0 && i < PHASES.length - 1 ? PHASES[i + 1] : null;
}

// A host may step back one phase from anywhere except the first and Done.
export function prevPhase(phase) {
  const i = PHASES.indexOf(phase);
  if (i <= 0 || phase === "done") return null;
  return PHASES[i - 1];
}

// Why the host cannot advance yet, or null when they can.
export function advanceBlocker(phase, { items = [], groups = [] } = {}) {
  if (phase === "group") {
    if (groups.length === 0) return "Group the cards before voting.";
    const groupIds = new Set(groups.map((g) => g.id));
    const loose = items.filter((it) => !it.groupId || !groupIds.has(it.groupId));
    if (loose.length) {
      return loose.length === 1 ? "1 card is not in a group yet." : `${loose.length} cards are not in a group yet.`;
    }
  }
  if (phase === "write" && items.length === 0) return "Add at least one card first.";
  return null;
}

export function ungroupedItems(items, groups) {
  const groupIds = new Set(groups.map((g) => g.id));
  return items.filter((it) => !it.groupId || !groupIds.has(it.groupId));
}

// Trimmed card text, or null when it is empty or too long.
export function cleanCardText(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t || t.length > MAX_CARD_LENGTH) return null;
  return t;
}

// The grouping prompt: card ids, column and text only, never an author.
export function groupingPrompt(items) {
  const cards = items.map((it) => ({ id: it.id, column: it.col, text: it.text }));
  return [
    "You are helping a software team run a Start / Stop / Continue retrospective.",
    "Group the cards below by meaning: cards about the same underlying topic belong together,",
    "even when they come from different columns. Aim for 3 to 9 groups; a card that fits nowhere",
    "may form its own group. Give each group a short title (2 to 6 words, sentence case) naming",
    "the shared theme, for example \"Release scope and code freeze\".",
    "Use every card id exactly once. Do not rewrite card text.",
    "",
    'Reply with only JSON of this shape: {"groups":[{"title":"...","itemIds":["id1","id2"]}]}',
    "",
    "Cards:",
    JSON.stringify(cards),
  ].join("\n");
}

// Makes a model's grouping safe to apply: every card lands in exactly one
// titled group, unknown ids are dropped and nothing is rewritten.
export function normaliseGroups(items, result) {
  const raw = Array.isArray(result) ? result : Array.isArray(result?.groups) ? result.groups : null;
  if (!raw) return null;
  const known = new Set(items.map((it) => it.id));
  const seen = new Set();
  const groups = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const ids = Array.isArray(g.itemIds) ? g.itemIds : [];
    const itemIds = [];
    for (const id of ids) {
      if (typeof id !== "string" || !known.has(id) || seen.has(id)) continue;
      seen.add(id);
      itemIds.push(id);
    }
    if (!itemIds.length) continue;
    const title = String(g.title ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    groups.push({ title: title || "Untitled theme", itemIds });
  }
  const missing = items.filter((it) => !seen.has(it.id)).map((it) => it.id);
  if (missing.length) {
    const other = groups.find((g) => g.title.toLowerCase() === OTHER_GROUP_TITLE.toLowerCase());
    if (other) other.itemIds.push(...missing);
    else groups.push({ title: OTHER_GROUP_TITLE, itemIds: missing });
  }
  return groups;
}

export function voteCounts(ballots) {
  const counts = {};
  for (const b of ballots) counts[b.groupId] = (counts[b.groupId] || 0) + 1;
  return counts;
}

// Groups ordered by votes, then card count, then title.
export function ranking(groups, items, ballots) {
  const counts = voteCounts(ballots);
  return groups
    .map((g) => ({
      ...g,
      votes: counts[g.id] || 0,
      cards: items.filter((it) => it.groupId === g.id),
    }))
    .sort((a, b) => b.votes - a.votes || b.cards.length - a.cards.length || a.title.localeCompare(b.title));
}

export function votesLeft(myBallotIds, budget = VOTE_BUDGET) {
  return Math.max(0, budget - (myBallotIds?.length || 0));
}

export function canVote(myBallotIds, budget = VOTE_BUDGET) {
  return votesLeft(myBallotIds, budget) > 0;
}

// True when more ballots exist than the people who voted could have cast.
export function overBudget(ballotCount, voterCount, budget = VOTE_BUDGET) {
  return ballotCount > budget * Math.max(0, voterCount);
}

export function isGroupingStale(groupingAt, now = Date.now()) {
  return !groupingAt || now - groupingAt > GROUPING_STALE_MS;
}

export function actionProgress(actions) {
  const done = actions.filter((a) => a.done).length;
  return { done, total: actions.length };
}

// The retro to show as current: the newest one that is not finished.
export function activeRetro(retros) {
  return [...retros].filter((r) => r.phase !== "done").sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

// The finished retro just before `retro`, whose actions the lobby reviews.
export function previousRetro(retros, retro) {
  return (
    [...retros]
      .filter((r) => r.phase === "done" && r.id !== retro?.id && (!retro || r.createdAt < retro.createdAt))
      .sort((a, b) => b.createdAt - a.createdAt)[0] || null
  );
}

export function defaultRetroTitle(date = new Date()) {
  return `Retro, ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

export function newId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

// Viewer-facing text for a db or sample error code.
export function errorMessage(code, action = "save that") {
  switch (code) {
    case "quota_exceeded":
      return "The retro history is full. Ask a host to delete old retros, then try again. Your text is still here.";
    case "invalid_argument":
      return `You can’t ${action}: you need Contributor access to this board.`;
    case "resource_exhausted":
    case "rate_limited":
      return "Too many changes at once. Wait a few seconds and try again.";
    case "revoked":
      return "Your access to this board changed. Reload the page.";
    case "not_granted":
      return "AI grouping needs your permission to use Claude. Allow it in the prompt, or group the cards by hand.";
    case "sampling_disabled":
      return "Claude isn’t available for this account, so group the cards by hand.";
    case "invalid_json":
      return "Claude’s answer couldn’t be read. Try again.";
    case "refused":
      return "Claude declined to group these cards. Group them by hand or try again.";
    case "session_expired":
      return "Your session expired. Sign in again, then retry.";
    case "prompt_too_large":
      return "There are too many cards to group in one go. Group some by hand first.";
    default:
      return "Something went wrong. Try again in a moment.";
  }
}
