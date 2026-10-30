# Proposal

## Why

The team runs Start / Stop / Continue retros on remoteretro.org. Grouping is a manual drag of overlapping cards on a free canvas, groups stay "Unlabeled", voting state is buried at the bottom of the page, and action items from past retros are not carried forward. We want a better-designed alternative that the whole team can use live together, that groups cards by meaning with an LLM, and that keeps a history of retros and their action items.

## What Changes

- Publish a single Claude artifact (claude.ai), shared with the team's claude.ai organization at Contributor level, that hosts all of the team's retros. The artifact owner and Editors act as hosts.
- Multi-user, real-time board built on the artifact runtime capabilities `db` (shared documents with live snapshots), `room` (presence), `user` (identity and team search) and `sample` (LLM calls from the page). No external backend.
- Host-driven phase flow: Lobby -> Write -> Group -> Vote -> Results -> Actions -> Done.
- Write phase: three columns (Start / Stop / Continue); every participant adds cards; cards are anonymous; typing is shown only as an anonymous count.
- Group phase: a host-only "Group with AI" button that clusters all cards semantically and titles each group; the host can then move cards, rename / merge / split / delete groups, and edit or delete cards. Everyone sees the result live.
- Vote phase: every participant has 3 anonymous votes (stacking on one group allowed); totals are hidden until the host reveals them.
- Results: groups ordered by votes, each showing all of its cards.
- Actions phase: anyone writes action items against a group; each action item must have an owner picked from the organization.
- History: a home screen listing past retros; the next retro's lobby reviews the previous retro's open action items, which owners or hosts can mark done.
- Visual design produced with the Hallmark design skill (app-screen scope) ([Hallmark](https://github.com/Nutlope/hallmark)).

## Capabilities

### New Capabilities
- `retro-session`: retro lifecycle and host control - creating retros, the phase state machine, host-only transitions, presence in the lobby, and the history of past retros.
- `retro-cards`: writing, editing and deleting anonymous Start / Stop / Continue cards during the Write phase.
- `retro-grouping`: LLM-based semantic grouping triggered by the host, its integrity guarantees, and host curation of groups and cards afterwards.
- `retro-voting`: anonymous, budgeted voting on groups, the reveal, and the ranked results view.
- `retro-action-items`: action items with required owners, written by anyone, and their review in the following retro.

### Modified Capabilities
<!-- None: the project has no existing specs. -->

## Impact

- New greenfield artifact: one self-contained HTML page published via the Artifact tool, declaring capabilities `db`, `room`, `user` (profile scope) and `sample`. Lives in this repo as source and is republished to the same URL on change.
- Data lives in the artifact's `db` store (cap 25,000 documents, ~85 per retro, so roughly 290 retros before pruning is needed).
- Access depends on claude.ai sharing: participants need Contributor ("interact") access; Viewers can only watch. Participants outside the organization are out of scope.
- Anonymity and the 3-vote budget are enforced by data layout and UI, not by access rules; a participant using the browser console could bypass the budget or edit others' cards. Accepted for an internal team tool.
- LLM grouping runs through `sample` in the host's browser and asks the host for consent on first use.
