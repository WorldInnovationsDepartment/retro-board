# Spec Delta

## Purpose

Defines how a retro is created, moves through its phases under host control, shows who is present, and is kept in a browsable history of past retros.

## ADDED Requirements

### Requirement: Host role
The system SHALL treat the artifact owner and anyone with Editor access as a host. Only hosts SHALL create retros and change a retro's phase. Participants with Contributor access SHALL take part but SHALL NOT see host controls.

#### Scenario: Contributor does not see host controls
- **WHEN** a Contributor opens a retro in any phase
- **THEN** no Start, phase-advance, Group with AI, reveal or finish controls are shown to them

#### Scenario: Editor acts as host
- **WHEN** an Editor opens a retro in the Lobby phase
- **THEN** the Start control is available to them

### Requirement: Read-only viewers
The system SHALL show a read-only board to signed-in viewers who lack write access, without offering inputs they cannot use.

#### Scenario: Viewer opens an active retro
- **WHEN** a person with Viewer access opens a retro in the Write phase
- **THEN** they see the board and a notice that they need Contributor access to take part, and no card input is shown

### Requirement: Retro creation
A host SHALL be able to create a new retro with a title (defaulting to the current date), which starts in the Lobby phase and becomes the active retro shown to everyone.

#### Scenario: Host starts a new retro
- **WHEN** a host clicks "New retro" on the home screen
- **THEN** a retro is created in the Lobby phase and every open view shows it as the active retro

### Requirement: Phase sequence
A retro SHALL move through the phases Lobby, Write, Group, Vote, Results, Actions and Done in that order. Only a host SHALL advance it, and every open view SHALL switch to the new phase within a few seconds without reloading.

#### Scenario: Host starts writing
- **WHEN** a host clicks Start in the Lobby
- **THEN** all participants' views switch to the Write phase with the Start / Stop / Continue columns

#### Scenario: Late joiner sees current phase
- **WHEN** a participant opens the artifact while a retro is in the Vote phase
- **THEN** they land directly in the Vote phase with current state

### Requirement: Host can step back one phase
A host SHALL be able to return a retro to the previous phase, except from Done, without losing cards, groups, votes or action items.

#### Scenario: Reopen writing after grouping started
- **WHEN** a host moves a retro from Group back to Write
- **THEN** existing cards and groups are kept and participants can add cards again

### Requirement: Presence
The system SHALL show who currently has the retro open, by name and avatar, marking the viewer as "you", and SHALL remove people shortly after they leave.

#### Scenario: Someone joins the lobby
- **WHEN** a participant opens a retro in the Lobby phase
- **THEN** every other open view shows them in the participant list

#### Scenario: Presence unavailable
- **WHEN** live presence cannot connect
- **THEN** the retro still works and the participant list is hidden or marked unavailable

### Requirement: Retro history
The system SHALL keep finished retros and list them on a home screen, newest first, with date, title, participant count, top-voted groups and open action-item count. Opening a finished retro SHALL show its results and action items read-only.

#### Scenario: Browse a past retro
- **WHEN** a participant opens a retro marked Done from the home screen
- **THEN** they see its ranked groups with cards and its action items, with no editing controls except action-item completion

### Requirement: Storage limit feedback
When the shared store is full, the system SHALL tell the viewer that the retro history has reached its capacity and that a host needs to remove old retros, instead of failing silently.

#### Scenario: Store is full
- **WHEN** creating a card fails because the store's capacity is reached
- **THEN** the viewer sees a message explaining the limit and the card text they typed is kept in the input
