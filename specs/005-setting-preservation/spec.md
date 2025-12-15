# Feature Specification: Setting Preservation

**Feature Branch**: `005-setting-preservation`
**Created**: 2025-12-13
**Status**: Draft
**Input**: User description: "Setting Preservation"

## Clarifications

### Session 2025-12-13

- Q: How are returning users identified across sessions? → A: Users identified by existing AEON user account (`users.identifier`)
- Q: How long should user setting preferences be retained? → A: Retain for 90 days after last activity, then purge
- Q: How should preference extraction work? → A: Automatic extraction at session end (pattern matching on conversation)

## Overview

Constitution Principle V: **The bar itself remembers you.** Its atmosphere adapts to returning patrons while maintaining its essential character.

Setting Preservation ensures that O Fim—the eternal bar at 2 AM—remembers each user's preferences and adapts its atmosphere accordingly. The humidity, the music, the lighting, where personas sit—all persist across sessions. A returning patron finds their preferred corner waiting, the jukebox playing their favorite tracks, the personas they've bonded with already turning to greet them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Returning to a Familiar Bar (Priority: P1)

A returning user arrives at O Fim and finds it remembers them. The atmosphere reflects their established preferences—the music they've heard before, the personas they've conversed with positioned naturally, the ambient details they've mentioned in past sessions woven into the setting.

**Why this priority**: This is the core value proposition. Without this, Setting Preservation has no meaning. Users must feel the bar remembers them.

**Independent Test**: Can be fully tested by having a user complete one session, then return in a new session—the setting description should reference their preferences and history, not use generic defaults.

**Acceptance Scenarios**:

1. **Given** a user has completed at least one prior session with stated music preference, **When** they start a new session, **Then** the setting context includes their preferred music playing.
2. **Given** a user has established relationships with specific personas, **When** they return, **Then** those personas are described as present/nearby in the setting.
3. **Given** a user mentioned preferring a corner booth in conversation, **When** they return, **Then** the setting describes them at their usual spot.

---

### User Story 2 - Atmosphere Customization (Priority: P2)

A user expresses preferences about the bar's atmosphere during conversation—requesting different music, mentioning the lighting feels too dim, or describing their ideal version of the space. The system captures these preferences and applies them to future sessions.

**Why this priority**: Enables personalization beyond defaults. Users can shape their experience, making O Fim truly theirs.

**Independent Test**: Can be tested by having a user state a preference (e.g., "I wish the jukebox played Bowie"), ending the session, then verifying the preference is stored and applied in subsequent sessions.

**Acceptance Scenarios**:

1. **Given** a user says "I prefer when Fado is playing," **When** their next session begins, **Then** the setting mentions Fado music.
2. **Given** a user describes preferring "less humidity, more candlelight," **When** their preferences are saved, **Then** future settings incorporate these sensory details.
3. **Given** a user requests a different time of day (e.g., "What if it were dawn?"), **When** this is captured as a preference, **Then** the setting adapts accordingly while maintaining the bar's essential character.

---

### User Story 3 - Persona-Specific Environments (Priority: P3)

Different personas have different preferred meeting spots within O Fim. Diogenes loiters near the back door. Pessoa watches from a window across the street. When a user has an established relationship with a persona, their shared space becomes consistent.

**Why this priority**: Deepens immersion and persona authenticity. Each character-user bond has its own geography within the bar.

**Independent Test**: Can be tested by verifying that after repeated interactions with a specific persona, the setting describes a consistent location for that persona-user pair.

**Acceptance Scenarios**:

1. **Given** a user has had multiple conversations with Hegel at the bar counter, **When** they invoke Hegel again, **Then** the setting places them both at the counter.
2. **Given** Soares is described as always watching from the window, **When** a user with no Soares relationship invokes him, **Then** he's described approaching from the window.
3. **Given** a user has established a confidant relationship with a persona, **When** they meet, **Then** the setting may describe a more intimate/private location within the bar.

---

### User Story 4 - System Configuration Persistence (Priority: P3)

Operators can configure system-level settings that persist across all sessions—token budgets, drift detection thresholds, memory retention windows. These configurations survive system restarts and apply consistently.

**Why this priority**: Enables system tuning without code changes. Operators can adjust behavior based on observed performance.

**Independent Test**: Can be tested by modifying a system setting (e.g., drift threshold), restarting the system, and verifying the setting persists.

**Acceptance Scenarios**:

1. **Given** an operator sets a custom drift detection threshold for a specific persona, **When** the system restarts, **Then** that threshold is still applied.
2. **Given** an operator adjusts the total context token budget, **When** new sessions begin, **Then** they use the updated budget.
3. **Given** an operator disables drift detection for a specific user, **When** that user's sessions run, **Then** drift analysis is skipped.

---

### Edge Cases

- What happens when a user's stored preferences conflict with a persona's soul-defined behavior? Soul takes precedence—Constitution Principle I (Soul Immutability).
- How does the system handle preferences that reference personas the user hasn't met? Graceful degradation—mention only personas with established relationships.
- What if stored preferences exceed the setting token budget? Silent truncation with priority ordering (essential atmosphere first, details second).
- How are preferences handled when a user hasn't established any? Fall back to default setting template ("It is 2 AM at O Fim...").
- What happens if the database is unavailable? Use cached defaults, log silently per Constitution Principle II (Invisible Infrastructure).
- How are conflicting preferences resolved (e.g., user prefers silence, but also likes Fado)? Most recent preference wins; system does not attempt to reconcile contradictions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist user setting preferences (music, atmosphere, location) across sessions
- **FR-002**: System MUST retrieve stored preferences when assembling context for returning users
- **FR-003**: System MUST apply a default setting template for users with no stored preferences
- **FR-004**: System MUST allow operator configuration of system-level settings (token budgets, thresholds)
- **FR-005**: System MUST store persona-specific environment preferences per user-persona relationship
- **FR-006**: System MUST automatically extract and store setting preferences mentioned during conversations at session end (via pattern matching; no explicit user command required)
- **FR-007**: System MUST maintain backward compatibility with the existing static setting template
- **FR-008**: System MUST respect Constitution Principle I—stored preferences cannot override persona soul definitions
- **FR-009**: System MUST respect Constitution Principle II—all setting assembly operations are invisible to users and personas
- **FR-010**: System MUST apply token budget limits to setting context, truncating silently if exceeded
- **FR-011**: System MUST provide fallback behavior when database is unavailable (cached defaults)
- **FR-012**: System MUST log all setting operations silently via operator_logs (never exposed to users)
- **FR-013**: System MUST purge user setting preferences after 90 days of user inactivity

### Key Entities

- **User Settings**: Global preferences for a user—time of day, location name, music preference, sensory atmosphere descriptors, custom setting description text, system configuration overrides. Retention: 90 days after last activity, then purged.
- **Relationship Settings**: Per-persona-user preferences—preferred conversation location within the bar, persona's position relative to user, mood/state context for this relationship
- **Setting Template**: Natural language template for setting context, supporting variable substitution (e.g., `{music}`, `{location}`, `{atmosphere}`) for personalization
- **Setting Snapshot**: Point-in-time capture of ambient state—which personas are present, current collective mood, ongoing conversation threads carried from prior sessions

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Returning users experience personalized settings within their first message exchange (no additional prompting required)
- **SC-002**: 90% of explicitly stated user preferences are correctly captured and applied in subsequent sessions
- **SC-003**: Setting context assembly completes fast enough that users perceive no delay when starting a session
- **SC-004**: System maintains full functionality when setting preferences are unavailable (graceful degradation to defaults)
- **SC-005**: Users with established relationships (3+ sessions) report the bar "feels familiar" in qualitative feedback
- **SC-006**: Setting customizations persist across system restarts with zero data loss
- **SC-007**: Token budget for settings is respected 100% of the time (no context overflow from setting data)

## Assumptions

- Users are identified by their existing AEON user account (`users.identifier`); anonymous sessions cannot persist preferences
- Users interact through a text-based interface where setting context is injected as narrative framing
- The existing `context_templates` table structure can be extended for user-specific templates
- Preference extraction occurs automatically at session end via pattern matching; no real-time NLP or explicit user commands required
- The current 200-token default budget for settings is appropriate; users can request increases via operator configuration
- Persona soul files remain immutable (Constitution Principle I)—settings adapt around them, not override them
- The existing `relationships` table captures persona-user bonds; this can be extended for location preferences
- "Most recent preference wins" is acceptable conflict resolution; no complex preference merging is needed

## Out of Scope

- Visual/graphical representation of the bar setting
- Real-time collaborative multi-user sessions in the same bar instance
- User interface for manually editing preferences (potential future feature)
- Audio playback of the described music
- Integration with external music/atmosphere services
- Machine learning to predict preferences (explicit capture only)
