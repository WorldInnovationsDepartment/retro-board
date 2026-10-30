# Spec Delta

## Purpose

Turns a retro's cards into titled groups by meaning, with a host-triggered LLM pass followed by host curation, so the team votes on themes rather than individual cards.

## ADDED Requirements

### Requirement: Group with AI button
During the Group phase a host SHALL have a "Group with AI" control that sends all of the retro's cards (column and text, no author) to an LLM and replaces the retro's groups with the result. Participants SHALL NOT have this control.

#### Scenario: Host groups the cards
- **WHEN** a host clicks "Group with AI" on a retro with 42 cards
- **THEN** the cards are organised into titled groups and every open view shows the groups

#### Scenario: Participant view
- **WHEN** a Contributor views the Group phase
- **THEN** they see the cards and any groups but no "Group with AI" control

### Requirement: Grouping progress is shared
While grouping runs, every open view SHALL show that grouping is in progress, and the host's control SHALL be disabled until it finishes.

#### Scenario: Grouping in progress
- **WHEN** the host has clicked "Group with AI" and the result has not returned
- **THEN** all participants see a grouping-in-progress indicator and the host cannot start a second run

### Requirement: Every card in exactly one group
After an AI grouping, every card of the retro SHALL belong to exactly one group. Cards the model omits SHALL be placed in a group titled "Other"; a card the model places in several groups SHALL be kept in only one. Card text SHALL NOT be changed by grouping.

#### Scenario: Model omits a card
- **WHEN** the model's result leaves out two cards
- **THEN** those two cards appear in a group titled "Other"

#### Scenario: Model duplicates a card
- **WHEN** the model's result lists one card in two groups
- **THEN** the card appears in only one of them

### Requirement: Meaningful group titles
Each AI-produced group SHALL have a short descriptive title naming its theme; no group SHALL be left untitled.

#### Scenario: Titles present
- **WHEN** AI grouping completes
- **THEN** every group shows a non-empty title describing its theme

### Requirement: Regroup
A host SHALL be able to run "Group with AI" again, which replaces all current groups, after confirming that manual changes to groups will be lost.

#### Scenario: Regroup after late cards
- **WHEN** a host regroups after the retro went back to Write and gained new cards
- **THEN** the host is asked to confirm, and on confirmation all cards including the new ones are regrouped

### Requirement: Grouping failure
If the LLM call fails, is refused or returns an unusable result, the system SHALL leave existing cards and groups unchanged and show the host the reason with a way to try again.

#### Scenario: LLM unavailable
- **WHEN** the grouping call fails
- **THEN** the host sees an error with a retry control and no groups are partially written

#### Scenario: Host declines consent
- **WHEN** the host declines the permission prompt for LLM use
- **THEN** grouping does not run, the host is told why, and manual grouping remains available

### Requirement: Host curation
During the Group phase a host SHALL be able to move a card between groups, rename a group, merge two groups, split cards into a new group, delete an empty group, and edit or delete a card. Changes SHALL appear for everyone within a few seconds.

#### Scenario: Move a card
- **WHEN** a host moves a card from "Meeting hygiene" to "Release scope"
- **THEN** every view shows the card under "Release scope"

#### Scenario: Merge groups
- **WHEN** a host merges two groups
- **THEN** one group remains containing the cards of both, with the title the host chose

#### Scenario: Keyboard curation
- **WHEN** a host uses only the keyboard
- **THEN** they can move a card to another group without a pointer device

### Requirement: Voting needs groups
A host SHALL NOT be able to advance from Group to Vote while any card is ungrouped or no group exists.

#### Scenario: Ungrouped cards remain
- **WHEN** a host tries to start voting with three ungrouped cards
- **THEN** the transition is blocked and the ungrouped cards are highlighted
