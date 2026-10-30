# Spec Delta

## Purpose

Lets every participant write Start / Stop / Continue cards during a retro's Write phase without revealing who wrote which card.

## ADDED Requirements

### Requirement: Three columns
During the Write phase the board SHALL show three columns, Start, Stop and Continue, each listing that column's cards for the active retro and offering an input to add a card to it.

#### Scenario: Board opens on Write
- **WHEN** the host starts the Write phase
- **THEN** every participant sees the Start, Stop and Continue columns, each with an add-card input

### Requirement: Adding cards
A participant with Contributor access SHALL be able to add any number of cards to any column during the Write phase. A card's text SHALL be non-empty after trimming and at most 500 characters. A new card SHALL appear for all participants within a few seconds.

#### Scenario: Card appears for everyone
- **WHEN** a participant submits "Stop scope expansion mid-sprint" in the Stop column
- **THEN** the card appears in the Stop column in every open view

#### Scenario: Empty card rejected
- **WHEN** a participant submits a card containing only whitespace
- **THEN** no card is created and the input stays focused

### Requirement: Card anonymity
The system SHALL NOT store or display the author of a card in any data readable by other participants or hosts. Card authorship SHALL be known only to the author's own browser views.

#### Scenario: Other participants cannot see authors
- **WHEN** any participant or host views or inspects the shared data for a card
- **THEN** no field identifies the person who wrote it

#### Scenario: Author recognises own cards
- **WHEN** a participant views the board
- **THEN** their own cards are marked as theirs, visible only to them

### Requirement: Editing and deleting own cards
During the Write phase a participant SHALL be able to edit or delete only cards they wrote, as tracked by their private record of authored cards.

#### Scenario: Edit own card
- **WHEN** a participant edits the text of a card they wrote
- **THEN** the updated text appears for everyone

#### Scenario: No edit control on others' cards
- **WHEN** a participant views a card written by someone else
- **THEN** no edit or delete control is offered

### Requirement: Anonymous writing activity
The system SHALL show how many people are currently typing as a single count for the whole board, without names and without indicating the column.

#### Scenario: Several people typing
- **WHEN** three participants are typing in different columns
- **THEN** every view shows "3 people writing" and nothing about who or where

### Requirement: Cards locked outside Write
Outside the Write phase, participants SHALL NOT be able to add, edit or delete cards; only hosts SHALL change cards, during the Group phase.

#### Scenario: Participant after Write
- **WHEN** a participant views the board in the Vote phase
- **THEN** no add, edit or delete card controls are shown to them
