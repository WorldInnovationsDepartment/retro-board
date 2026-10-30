import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHASES,
  nextPhase,
  prevPhase,
  advanceBlocker,
  cleanCardText,
  groupingPrompt,
  normaliseGroups,
  ranking,
  votesLeft,
  canVote,
  overBudget,
  isGroupingStale,
  activeRetro,
  previousRetro,
  errorMessage,
} from "../src/logic.mjs";

const items = [
  { id: "a", col: "stop", text: "Scope keeps growing", groupId: null },
  { id: "b", col: "start", text: "QA freeze", groupId: null },
  { id: "c", col: "stop", text: "Too many calls", groupId: null },
];

test("phases run in order and end at done", () => {
  assert.deepEqual(PHASES, ["lobby", "write", "group", "vote", "results", "actions", "done"]);
  assert.equal(nextPhase("lobby"), "write");
  assert.equal(nextPhase("actions"), "done");
  assert.equal(nextPhase("done"), null);
});

test("host can step back except from lobby and done", () => {
  assert.equal(prevPhase("group"), "write");
  assert.equal(prevPhase("lobby"), null);
  assert.equal(prevPhase("done"), null);
});

test("voting is blocked while cards are ungrouped", () => {
  const groups = [{ id: "g1" }];
  assert.equal(advanceBlocker("group", { items, groups: [] }), "Group the cards before voting.");
  const partly = items.map((it, i) => ({ ...it, groupId: i === 0 ? "g1" : null }));
  assert.equal(advanceBlocker("group", { items: partly, groups }), "2 cards are not in a group yet.");
  const all = items.map((it) => ({ ...it, groupId: "g1" }));
  assert.equal(advanceBlocker("group", { items: all, groups }), null);
  const stale = items.map((it) => ({ ...it, groupId: "gone" }));
  assert.equal(advanceBlocker("group", { items: stale, groups }), "3 cards are not in a group yet.");
});

test("card text is trimmed and bounded", () => {
  assert.equal(cleanCardText("   "), null);
  assert.equal(cleanCardText("  Stop  scope\n creep "), "Stop scope creep");
  assert.equal(cleanCardText("x".repeat(500)).length, 500);
  assert.equal(cleanCardText("x".repeat(501)), null);
});

test("grouping prompt carries no author", () => {
  const p = groupingPrompt([{ ...items[0], author: "u_1" }]);
  assert.ok(p.includes('"id":"a"'));
  assert.ok(!p.includes("u_1"));
});

test("normalise: omitted cards go to Other", () => {
  const out = normaliseGroups(items, { groups: [{ title: "Scope", itemIds: ["a"] }] });
  assert.deepEqual(out, [
    { title: "Scope", itemIds: ["a"] },
    { title: "Other", itemIds: ["b", "c"] },
  ]);
});

test("normalise: duplicated card kept once, unknown ids dropped, empty groups dropped", () => {
  const out = normaliseGroups(items, {
    groups: [
      { title: "Scope", itemIds: ["a", "b", "zzz"] },
      { title: "Process", itemIds: ["b", "c"] },
      { title: "Ghost", itemIds: ["nope"] },
    ],
  });
  assert.deepEqual(out, [
    { title: "Scope", itemIds: ["a", "b"] },
    { title: "Process", itemIds: ["c"] },
  ]);
});

test("normalise: untitled groups get a title and bad shapes return null", () => {
  assert.deepEqual(normaliseGroups(items, [{ title: "  ", itemIds: ["a", "b", "c"] }]), [
    { title: "Untitled theme", itemIds: ["a", "b", "c"] },
  ]);
  assert.equal(normaliseGroups(items, { nope: 1 }), null);
  assert.equal(normaliseGroups(items, "text"), null);
});

test("normalise: missing cards join an existing Other group", () => {
  const out = normaliseGroups(items, { groups: [{ title: "other", itemIds: ["a"] }] });
  assert.deepEqual(out, [{ title: "other", itemIds: ["a", "b", "c"] }]);
});

test("ranking: votes, then card count, then title (spec tie scenario)", () => {
  const groups = [
    { id: "g2", title: "Two cards" },
    { id: "g9", title: "Nine votes" },
    { id: "g4", title: "Four cards" },
  ];
  const cards = [
    ...Array.from({ length: 2 }, (_, i) => ({ id: `x${i}`, groupId: "g2" })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `y${i}`, groupId: "g4" })),
    { id: "z", groupId: "g9" },
  ];
  const ballots = [
    ...Array.from({ length: 9 }, () => ({ groupId: "g9" })),
    ...Array.from({ length: 6 }, () => ({ groupId: "g4" })),
    ...Array.from({ length: 6 }, () => ({ groupId: "g2" })),
  ];
  const ranked = ranking(groups, cards, ballots);
  assert.deepEqual(ranked.map((g) => g.id), ["g9", "g4", "g2"]);
  assert.deepEqual(ranked.map((g) => g.votes), [9, 6, 6]);
  assert.equal(ranked[1].cards.length, 4);
});

test("vote budget of 3 with stacking and take-back", () => {
  assert.equal(votesLeft([]), 3);
  assert.equal(votesLeft(["1", "2"]), 1);
  assert.equal(canVote(["1", "2", "3"]), false);
  assert.equal(votesLeft(["1", "2", "3", "4"]), 0);
});

test("overrun warning when ballots exceed 3 x voters", () => {
  assert.equal(overBudget(17, 5), true);
  assert.equal(overBudget(15, 5), false);
  assert.equal(overBudget(1, 0), true);
});

test("grouping marker goes stale after two minutes", () => {
  assert.equal(isGroupingStale(null), true);
  assert.equal(isGroupingStale(1000, 1000 + 60_000), false);
  assert.equal(isGroupingStale(1000, 1000 + 121_000), true);
});

test("active and previous retros", () => {
  const retros = [
    { id: "r1", phase: "done", createdAt: 1 },
    { id: "r2", phase: "done", createdAt: 2 },
    { id: "r3", phase: "lobby", createdAt: 3 },
  ];
  assert.equal(activeRetro(retros).id, "r3");
  assert.equal(previousRetro(retros, retros[2]).id, "r2");
  assert.equal(previousRetro(retros, retros[0]), null);
  assert.equal(activeRetro(retros.slice(0, 2)), null);
});

test("store-full message keeps the viewer's text", () => {
  assert.match(errorMessage("quota_exceeded"), /history is full/);
  assert.match(errorMessage("quota_exceeded"), /text is still here/);
  assert.match(errorMessage("weird_code"), /went wrong/);
});
