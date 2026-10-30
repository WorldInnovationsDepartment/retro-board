# Tasks

## 1. Scaffold and design direction

- [x] 1.1 Create `src/index.html`, `src/styles.css`, `src/app.js`, `src/logic.mjs`, `scripts/build.mjs` and `test/` (design D8); verify `node scripts/build.mjs` writes `dist/retro-board.html` with the CSS and JS inlined
- [x] 1.2 Run Hallmark in app-screen scope ([Hallmark](https://github.com/Nutlope/hallmark)): pre-flight, the four-question ask (or "go ahead"), `theme.mjs deal`, user picks one of three; verify the Picks block is shown and the chosen theme's tokens are in `src/styles.css` at `:root` with light and dark blocks
- [x] 1.3 Build the app shell (top bar with retro title, phase stepper, participant strip, main region) with loading / empty / error states; verify `node <hallmark>/scripts/sloplint.mjs dist/retro-board.html --scope app --render` reports no FAIL

## 2. Runtime wiring and session lifecycle (spec: retro-session)

- [ ] 2.1 Resolve `db`, `room`, `user`, `sample` via `claude.use()` with null handling and the read-only/signed-out notice; verify the page renders its shell with every capability null (open the built file locally)
- [x] 2.2 Implement phase transition rules in `logic.mjs` (order, step back except from Done, Group->Vote guard); verify with `node --test test/logic.test.mjs`
- [ ] 2.3 Implement home screen (history list newest first, open-action counts) and host-only "New retro"; verify a Contributor sees no host controls by checking `user.canEdit()` branches in a published preview
- [ ] 2.4 Implement Lobby with `room` presence (names via `profiles()`, "you" marker) and host Start; verify two browser sessions see each other and both switch to Write on Start
- [x] 2.5 Implement storage-full handling (`quota_exceeded` message, keep typed text); verify by unit-testing the error-to-message mapping in `logic.mjs`

## 3. Anonymous cards (spec: retro-cards)

- [ ] 3.1 Implement three columns with add-card input (trim, 1-500 chars) writing `items/{random}` without author and recording the id in `data/users/<me>/retro`; verify via `ArtifactData list items` that no author field exists
- [ ] 3.2 Implement edit/delete for own cards only, and lock cards outside Write for participants; verify in two sessions that only the author sees controls
- [ ] 3.3 Implement count-only typing indicator over `room` presence; verify two sessions typing show "2 people writing" with no names

## 4. AI grouping and host curation (spec: retro-grouping)

- [x] 4.1 Implement `normaliseGroups(items, result)` in `logic.mjs` (unknown ids dropped, duplicates kept once, missing to "Other", empty groups dropped); verify with unit tests for each case
- [ ] 4.2 Implement host-only "Group with AI" via `sample.json` with shared `groupingAt` progress, consent-declined and failure handling, and apply-after-normalise writes; verify on a seeded retro of ~40 cards that every card ends in exactly one titled group
- [ ] 4.3 Implement Regroup with confirmation; verify regrouping after adding cards includes them
- [ ] 4.4 Implement curation: move (menu + drag), rename, merge, split, delete empty group, edit/delete card; verify keyboard-only move works and changes appear in a second session
- [ ] 4.5 Block Group->Vote while cards are ungrouped and highlight them; verify by attempting the transition with an ungrouped card

## 5. Anonymous voting and results (spec: retro-voting)

- [x] 5.1 Implement vote budget and ranking (`ranking(groups, ballots)` with tie-break by card count then title) in `logic.mjs`; verify with unit tests including the spec's tie scenario
- [ ] 5.2 Implement voting UI: ballots as `ballots/{random}`, private ballot ids, stacking, take-back, "N votes left", totals hidden before reveal; verify via `ArtifactData list ballots` that ballots carry no author and the UI shows no totals before reveal
- [ ] 5.3 Implement per-person voting progress over presence and the host overrun warning; verify warning appears when ballots exceed 3 x voters in a seeded test
- [ ] 5.4 Implement Reveal -> Results ranked board (signature object) with all cards per group; verify ordering against seeded data

## 6. Action items and finishing (spec: retro-action-items)

- [ ] 6.1 Implement add/edit/delete action items per group with required owner picker (`user.search`, store id, resolve names at render); verify an ownerless action cannot be saved
- [ ] 6.2 Implement done toggle for owner or host, including in finished retros; verify a non-owner Contributor gets no toggle
- [ ] 6.3 Implement previous-retro action review in the Lobby ("x of y done"); verify with a finished seeded retro
- [ ] 6.4 Implement Finish (phase Done, read-only except done toggles); verify a finished retro shows no edit controls

## 7. Publish and integration check

- [x] 7.1 Publish `dist/retro-board.html` with capabilities `{db: {rules}, room: {}, user: {scopes: ["profile"]}, sample: {}}` per design D2; verify one `ArtifactData list` per collection and an `as_level: "view"` read returning no retro content
- [ ] 7.2 Run a full retro end to end with at least two people (Lobby -> Done); verify every phase syncs live and sloplint `--scope app` is still clean on the published build
- [x] 7.3 Write `README.md` covering how to host a retro, sharing with the organization as Contributor, and rebuild/republish; verify the commands in it run as written

## Workflow follow-up

- Archive the change after the team has used it for one real retro.
