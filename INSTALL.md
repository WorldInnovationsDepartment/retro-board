# Install Retro Board into your Claude space

This file is written for Claude to follow. To install, open Claude Code and say:

> Install the retro board from https://github.com/WorldInnovationsDepartment/retro-board. Follow its INSTALL.md.

The board runs entirely as a Claude artifact on claude.ai. There is no server to host: cards, groups, votes and actions live in the artifact's own database, and presence, identity and AI grouping come from the artifact runtime.

---

## Instructions for Claude

Follow these steps in order. Stop and tell the person if a check fails; do not work around it.

### 0. Check the environment

You need all of these. If one is missing, stop and say which.

1. **The `Artifact` tool** (publishing artifacts to claude.ai). This exists in Claude Code signed in with a claude.ai account. Chat artifacts inside a claude.ai conversation are a different runtime and will not work.
2. **Runtime capabilities `db`, `room`, `user` and `sample` available to this account.** Load the `artifact-capabilities` skill and confirm all four names appear in its list of available capabilities. If any is missing, stop: the board cannot work without it.
3. **Node.js 18 or newer** (`node --version`). Only used to build the single HTML file and run the tests.
4. **git**, to clone the repository.

### 1. Get the code

```sh
git clone https://github.com/WorldInnovationsDepartment/retro-board.git
cd retro-board
```

Read `README.md` and skim `openspec/changes/retro-board-artifact/design.md` so you know what the page does before publishing it. You must read the built file before publishing it (step 3).

### 2. Build and test

```sh
node scripts/build.mjs           # writes dist/retro-board.html (about 85 KB)
node --test test/logic.test.mjs  # expect: pass 15, fail 0
```

If a test fails, stop and report the output.

### 3. Publish the artifact

Read `dist/retro-board.html` in full, then publish it with the `Artifact` tool:

- `file_path`: the absolute path to `dist/retro-board.html`
- `icon`: `board`
- `description`: `Live Start / Stop / Continue retros: anonymous cards, AI grouping, anonymous votes, owned action items and history.`
- `capabilities`, exactly:

```json
{
  "db": {
    "rules": [
      { "path": "", "read": "view", "write": "interact" },
      { "path": "retros", "read": "view", "write": "admin" },
      { "path": "groups", "read": "view", "write": "admin" },
      { "path": "data/users/{self}", "write": "interact" }
    ]
  },
  "room": {},
  "user": { "scopes": ["profile"] },
  "sample": {}
}
```

What each rule does, so you can explain it:

| Path | Read | Write | Why |
|---|---|---|---|
| everything (`""`) | Viewers and up | Contributors and up | Everyone can watch; Contributors add cards, votes and actions |
| `retros` | Viewers and up | Editors and owner | Only hosts create retros and change phases |
| `groups` | Viewers and up | Editors and owner | Only hosts group and curate cards |
| `data/users/{self}` | only that person | that person | Private list of the cards and votes you cast; this is what keeps cards and votes anonymous |

Do not change these rules unless the person asks. Loosening `data/users` would expose who wrote which card.

Keep the returned artifact URL; you need it below.

### 4. Verify the access rules

Load the `ArtifactData` tool and run this check against the new URL. It writes one probe document and deletes it.

1. `set` in collection `retros`, doc id `probe-host`, data `{"title":"probe"}`, with `as_level: "interact"`. **Expected: refused** (reads as not found). Only hosts may write retros.
2. `set` in collection `items`, doc id `probe-item`, data `{"retroId":"probe","col":"start","text":"probe","groupId":null,"createdAt":0}`, with `as_level: "interact"`. **Expected: committed.**
3. `list` collection `items` with `as_level: "view"`. **Expected:** the probe is visible and has no author field.
4. `delete` collection `items`, doc id `probe-item`, with the `if_version` returned in step 2.

If step 1 succeeds or step 2 fails, the rules did not apply: republish with the exact `capabilities` above.

### 5. Hand over to the person

Tell them, in plain words:

- The link, and that it is **private** until they share it.
- **Sharing:** open the artifact, use **Share**, and give their claude.ai organization (or the specific teammates) **Contributor** access. Give hosts **Editor** access. Viewers can watch but cannot write. Only people in the organization or invited to the artifact can take part; a public link cannot write.
- **Hosting a retro:** open the board, choose **New retro**, then use the bar at the bottom to move through Lobby, Write, Group, Vote, Results, Actions and Done.
- **AI grouping:** the first time the host presses **Group with AI**, claude.ai asks them to allow the board to use Claude. It runs on the host's own Claude usage.
- **Known limit:** anonymity and the 3-vote budget are enforced by how data is stored and by the interface. Someone using the browser console could add extra votes; the host sees a warning when votes exceed 3 per voter.
- **Capacity:** the database holds 25,000 documents, about 290 retros. Hosts can delete finished retros.

Do not seed the database with example retros. The team fills it.

---

## Customising (optional)

If the person wants it shaped to their process, change the source in `src/`, rebuild, rerun the tests, and republish the same file to the same URL (data is kept across republishes; omit `capabilities` on a republish to keep the stored ones).

| Change | Where |
|---|---|
| Column names and prompts (Mad / Sad / Glad, 4Ls) | `COLUMNS` in `src/logic.mjs` |
| Vote budget | `VOTE_BUDGET` in `src/logic.mjs` |
| Phase order or new phases | `PHASES` in `src/logic.mjs`, then a `render<Phase>` view in `src/app.js` |
| Grouping prompt and team vocabulary | `groupingPrompt` in `src/logic.mjs` |
| Look and feel | tokens at the top of `src/styles.css` (light and dark) |

The full behaviour contract is in `openspec/changes/retro-board-artifact/specs/`; update it when behaviour changes.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Page says "Open this board in claude.ai" | Opened outside claude.ai or signed out. Open the artifact link while signed in. |
| "You can watch this board" notice | The viewer has Viewer access. Give them Contributor in Share. |
| No New retro button | Only the owner and Editors host. Give the host Editor access. |
| Group with AI disabled or failing | The host declined the Claude permission prompt, or Claude is unavailable for the account. Group by hand, or allow it from the artifact's Permissions menu. |
| "The retro history is full" | The 25,000-document cap is reached. A host deletes old finished retros. |
| Nobody shows as present | Live presence (`room`) could not connect. The board still works; reload later. |
