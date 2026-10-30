# Spec Delta

## Purpose

Lets every participant spend a fixed budget of anonymous votes on a retro's groups and then shows the groups ranked by those votes.

## ADDED Requirements

### Requirement: Vote budget
During the Vote phase each participant SHALL have 3 votes per retro, SHALL be able to place more than one vote on the same group, and SHALL be able to take a vote back while the phase is open. The interface SHALL NOT allow more than 3 votes.

#### Scenario: Stack votes
- **WHEN** a participant adds 2 votes to one group and 1 to another
- **THEN** their remaining budget shows 0 and the add-vote controls are disabled

#### Scenario: Take a vote back
- **WHEN** a participant with 0 votes left removes a vote from a group
- **THEN** their remaining budget shows 1

### Requirement: Remaining votes visible
The system SHALL show each participant their remaining votes next to the groups throughout the Vote phase.

#### Scenario: Budget shown
- **WHEN** a participant enters the Vote phase
- **THEN** they see "3 votes left" near the group list

### Requirement: Vote anonymity
The system SHALL NOT store or display which participant cast which vote in any data readable by other participants or hosts. A participant's own votes SHALL be known only to their own views.

#### Scenario: Inspecting votes
- **WHEN** any participant or host views or inspects the shared vote data
- **THEN** no field links a vote to the person who cast it

### Requirement: Hidden totals until reveal
Vote totals SHALL be hidden from everyone, hosts included, until a host reveals them. Before the reveal each participant SHALL see only their own votes.

#### Scenario: During voting
- **WHEN** participants are voting
- **THEN** no view shows how many votes any group has received from others

### Requirement: Voting progress
During the Vote phase the system SHALL show, per present participant, whether they have used all their votes, without showing where those votes went.

#### Scenario: Progress strip
- **WHEN** a participant has used 3 of 3 votes
- **THEN** others see them marked as done voting

### Requirement: Budget overrun warning
When the total number of votes in a retro exceeds 3 times the number of people who voted, the host SHALL see a warning before revealing.

#### Scenario: Extra votes detected
- **WHEN** 5 people voted and 17 votes exist
- **THEN** the host sees a warning that votes exceed the budget

### Requirement: Reveal and ranked results
When a host reveals, the retro SHALL enter the Results phase, showing groups ordered by vote total, highest first, each with its total, title and all of its cards. Ties SHALL be ordered by number of cards, then title.

#### Scenario: Results order
- **WHEN** a host reveals with groups at 9, 6 and 6 votes, the 6-vote groups having 4 and 2 cards
- **THEN** the list shows the 9-vote group first, then the 4-card group, then the 2-card group, each listing all its cards
