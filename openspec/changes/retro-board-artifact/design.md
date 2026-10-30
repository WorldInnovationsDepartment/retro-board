# Design

## Context

Greenfield: this repo holds only OpenSpec scaffolding. The product is a single Claude artifact page on claude.ai (see proposal.md - Why). The constraints that shape the approach come from the artifact runtime (contract 0.2.92):

- `db`: JSON documents at slash paths, live `onSnapshot`, last-writer-wins, **no transactions and no atomic counters**, no author metadata on documents. Access rules are fixed path prefixes with levels `view` < `interact` < `admin` < `owner`, plus `{self}` per-viewer subtrees; **no wildcard segments other than `{self}`**. `data/users/<id>/` is private to that viewer. Limits: 25,000 documents per artifact, 256 KiB per document, 64 subscriptions per view, 64 rules.
- `room`: ephemeral presence and events to whoever is connected; nothing persists, messages can drop, presence is untrusted.
- `user`: opaque `id()`, `profiles(ids)`, `search(q)` with `scopes: ["profile"]`; `isOwner()` / `canEdit()` (admin) for host checks. Store ids only, resolve names at render.
- `sample`: memoryless LLM call from the page; `sample.json` returns parsed JSON; asks the viewer for consent on first call.
- Everyone is in the same claude.ai organization; participants are shared at Contributor (`interact`), hosts are the owner and Editors (`admin`).

## Goals / Non-Goals

**Goals:**
- Real-time multi-user board with no backend beyond the artifact runtime.
- Anonymity of cards and votes by data layout, not by UI hiding alone.
- A design that passes Hallmark's Floor and `sloplint --scope app`.

**Non-Goals:**
- Cryptographic anonymity or cheat-proof vote budgets (see Risks).
- Participants outside the organization, or public links.
- Timers, reactions, card comments, exporting to Jira/Linear, multiple simultaneous active retros.

## Decisions

### D1. `db` for all lasting state, `room` only for presence
Every fact a late joiner needs (phase, cards, groups, ballots, actions) is a `db` document; `room` carries only presence (name, typing flag, voting progress) and a "grouping in progress" hint mirrored in the retro document.
*Alternative:* the `artifact` capability (republish the whole page on each change). Rejected: concurrent writers conflict and every view reloads on each save.

### D2. Flat collections tagged by `retroId`
Rules cannot address `retros/{rid}/items`, so collections are top-level and each document carries `retroId`; views query `where("retroId","==",rid)`.

```
retros/{rid}            { title, createdAt, phase, groupingAt?, finishedAt? }     write: admin
items/{iid}             { retroId, col: start|stop|continue, text, groupId? }     write: interact
groups/{gid}            { retroId, title, order }                                 write: admin
ballots/{bid}           { retroId, groupId }                                      write: interact
actions/{aid}           { retroId, groupId, text, ownerId, done }                 write: interact
data/users/<me>/retro   { [rid]: { items: [iid], ballots: [bid] } }               private to me
```

Rules (fits well under 64):
```
{ path: "",        read: "view",     write: "interact" }
{ path: "retros",  read: "view",     write: "admin" }
{ path: "groups",  read: "view",     write: "admin" }
{ path: "data/users/{self}", write: "interact" }
```
`read: "view"` lets Viewers watch the board read-only (spec: Read-only viewers); only Contributors and above write. The active retro is the newest `retros` doc not in `done`.
*Alternative:* nest per-retro subcollections. Rejected: per-phase access cannot be expressed without wildcards.

### D3. Anonymous cards: no author field, private authorship index
Creating a card writes `items/{random}` with no author, then appends its id to `data/users/<me>/retro[rid].items`. Edit/delete controls appear only for ids in that private list.
*Alternative:* `items/{self}/...`. Rejected: the path is the user id, which `profiles()` resolves to a name.

### D4. Anonymous votes as unlinkable ballot documents
One document per vote (`ballots/{random}`), no author, so totals are a count per `groupId` and concurrent votes never collide (no counter to race on). A vote creates a ballot then records its id privately; un-voting deletes one of my ballot ids. Budget 3 is checked against the private list. Totals are hidden in the UI until `phase` reaches `results`; the host sees an overrun warning if `ballots > 3 x voters`, where voters come from presence-reported progress.
*Alternatives:* `votes/{self}` map (rejected: links votes to people); shared counter per group (rejected: last-writer-wins loses concurrent increments).

### D5. LLM grouping in the host's browser
"Group with AI" runs `sample.json` with `modelTier: "default"` and `cache: false`, sending `[{id, col, text}]` and asking for `{groups: [{title, itemIds}]}`. The page then normalises: drop unknown ids, keep the first occurrence of duplicated ids, put missing ids into "Other", drop empty groups. Only after normalising does it delete old groups, write new `groups` docs, and set each item's `groupId`, writing one document at a time. `retros/{rid}.groupingAt` is set during the run so all views show progress and the host's button is disabled.
*Alternative:* participants trigger grouping or each view groups locally. Rejected: inconsistent groups and repeated consent prompts.

### D6. Host curation with accessible drag
Moves update one item's `groupId`; merge re-points items then deletes the empty group; split creates a group and re-points the selected items. Each card has a "Move to..." menu so curation works by keyboard and on touch; pointer drag is an enhancement.

### D7. Action owners by user id
The owner picker uses `user.search(q)` (profile scope); `ownerId` stores the opaque id; names resolve via `profiles()` on every render. Done-toggling is offered to the owner (`user.id() === ownerId`) or a host.

### D8. One self-contained HTML file, Hallmark app-screen design
The published page is one HTML file with inline CSS/JS, republished to the same artifact URL. Source lives in `src/` (`index.html`, `styles.css`, `app.js`, and `logic.mjs` for pure functions: grouping normalisation, ranking, vote budget, phase transitions); a dependency-free `scripts/build.mjs` inlines them into `dist/retro-board.html`, and `node --test` covers `logic.mjs`. Design follows [Hallmark](https://github.com/Nutlope/hallmark) in app-screen scope: dealt theme lends palette, type and radius only; tokens at `:root` with light and dark themes; 32-40px controls with 44px hit targets; loading / empty / error / full states for every data region; `prefers-reduced-motion` fallbacks; `sloplint.mjs --scope app` clean before publishing. The signature object is the ranked results board.

## Risks / Trade-offs

- [Anonymity and budgets are enforced by layout and UI, not rules] -> a Contributor using the console could edit others' cards or add extra ballots. Mitigation: overrun warning for the host; acceptable for an internal team.
- [Timing can de-anonymise] -> a card or ballot appearing right after one person acts. Mitigation: typing shown as a count only, ballot totals hidden until reveal.
- [Done retros are read-only only in the UI] -> rules are per path, not per retro state. Mitigation: UI hides controls once `phase = done`; accepted.
- [LLM misgroups or exceeds context with very large retros] -> Mitigation: host curation and Regroup; cap card text at 500 chars; for > 150 cards, show a warning before grouping.
- [Many sequential writes when applying groups] -> one write at a time per doc, ~50-100 writes. Mitigation: show progress; write groups first, then items.
- [Store capacity: ~85 documents per retro, 25,000 cap] -> about 290 retros. Mitigation: capacity message (spec) and, later, compaction of finished retros into a single snapshot document.
- [Presence is untrusted] -> never used for host authority; host checks use `user.canEdit()` and rules.

## Migration Plan

No data to migrate. Publish once with capabilities `{ db: { rules }, room: {}, user: { scopes: ["profile"] }, sample: {} }`, share with the organization as Contributor, and verify with one `ArtifactData list` per collection plus a lower `as_level` read. Rollback: republish the previous version to the same URL; data is kept across republishes.

## Open Questions

- Which Hallmark theme to use: dealt at build time from three options.
