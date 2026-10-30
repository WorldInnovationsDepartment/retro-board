# Retro Board

A live Start / Stop / Continue retro board for a team. It runs entirely as a Claude artifact on claude.ai: no server, no hosting. Cards, groups, votes and actions are stored in the artifact's own database; presence, identity and AI grouping come from the artifact runtime.

## Install it in your Claude space

Open Claude Code and say:

> Install the retro board from https://github.com/WorldInnovationsDepartment/retro-board. Follow its INSTALL.md.

[INSTALL.md](INSTALL.md) has every step Claude needs: build, publish with the right capabilities, verify the access rules, and share.

## Sharing

Open the artifact, use **Share**, and give your claude.ai organization **Contributor** access. Contributors write cards, vote and add actions. Give hosts **Editor** access: hosts start retros, move between phases, run Group with AI and reveal votes. Viewers can watch but not write.

## Running a retro (host)

1. Open the board and choose **New retro** (or open the board's history from the wordmark). Everyone who opens the link lands in the lobby, which also shows the last retro's actions.
2. **Start writing**: three columns, anonymous cards.
3. **Start grouping**: press **Group with AI**, then move cards, rename, merge or make new groups. Every card needs a group before voting.
4. **Start voting**: everyone has 3 anonymous votes; totals stay hidden.
5. **Reveal votes**: themes ranked by votes with all their cards.
6. **Write actions**: anyone adds actions under a theme; each needs an owner.
7. **Finish retro**: the retro locks and moves to history. Owners can still tick actions done.

The host bar at the bottom also steps back one phase.

## Changing the board

Source lives in `src/` (`index.html`, `styles.css`, `app.js`, `logic.mjs`). Build the single publishable page and run the tests:

```sh
node scripts/build.mjs        # writes dist/retro-board.html
node --test test/logic.test.mjs
```

Then ask Claude Code to republish `dist/retro-board.html` to the same artifact URL.

The `demo-video/` folder holds the Remotion source for the demo video (`npm install`, `npm run capture`, `node scripts/sfx.mjs`, `npm run render`). Data is kept across republishes. The design follows Hallmark's Coral theme in app-screen scope; check it with Hallmark's `scripts/sloplint.mjs dist/retro-board.html --scope app`.

Planning artifacts (proposal, specs, design, tasks) are in `openspec/changes/retro-board-artifact/`.

## Known limits

- Card anonymity and the 3-vote budget are enforced by how data is stored and by the interface, not by access rules. Someone using the browser console could edit others' cards or add extra votes; the host sees a warning when votes exceed 3 per voter.
- The database holds 25,000 documents, roughly 290 retros. Hosts can delete a finished retro from its page.
