# Spec Delta

## Purpose

Captures the concrete actions a retro commits to, each with an accountable owner from the team, and brings open actions back into the next retro for review.

## ADDED Requirements

### Requirement: Anyone writes action items
During the Actions phase any participant with Contributor access SHALL be able to add an action item attached to one of the retro's groups. Action items SHALL appear for everyone within a few seconds.

#### Scenario: Add action to a group
- **WHEN** a participant adds "Introduce a QA freeze 3 days before release" under "Release scope"
- **THEN** every view shows the action under that group

### Requirement: Owner required
Every action item SHALL have exactly one owner chosen from people in the organization by searching names. An action item without an owner SHALL NOT be saved. Owner names SHALL be shown as currently known, not as stored text.

#### Scenario: Missing owner
- **WHEN** a participant tries to add an action item without picking an owner
- **THEN** it is not saved and the owner picker is highlighted

#### Scenario: Pick owner
- **WHEN** a participant types "Mak" in the owner picker
- **THEN** matching people from the organization are offered and the chosen person is shown as owner

### Requirement: Editing action items
During the Actions phase any participant SHALL be able to edit an action item's text or owner, or delete it.

#### Scenario: Reassign owner
- **WHEN** a participant changes an action's owner
- **THEN** every view shows the new owner

### Requirement: Completing action items
The owner of an action item or a host SHALL be able to mark it done or not done at any time, including after the retro is finished.

#### Scenario: Owner completes action
- **WHEN** the owner ticks their action item as done in a finished retro
- **THEN** it shows as done everywhere, including in the history list's open-action count

### Requirement: Review previous actions
When a retro is in the Lobby phase, the system SHALL show the most recent finished retro's action items with owner and done state, so the team can review them before starting.

#### Scenario: Lobby review
- **WHEN** participants join a new retro's lobby and the previous retro had 5 action items, 3 done
- **THEN** the lobby lists those 5 items, shows "3 of 5 done", and lets owners or hosts tick the rest

### Requirement: Finishing a retro
A host SHALL be able to finish a retro from the Actions phase, after which its cards, groups, votes and action text become read-only; only action-item completion stays editable.

#### Scenario: Finish
- **WHEN** a host finishes the retro
- **THEN** it appears in history as Done and no participant can add or edit its cards, groups, votes or action items except their done state
