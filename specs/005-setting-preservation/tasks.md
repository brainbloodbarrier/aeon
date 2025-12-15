# Tasks: Setting Preservation

**Input**: Design documents from `/specs/005-setting-preservation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests ARE included as specified in plan.md (unit tests and integration tests).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure (single project):
- Compute modules: `compute/`
- Database migrations: `db/migrations/`
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema

- [ ] T001 Create database migration file db/migrations/006_setting_preservation.sql
- [ ] T002 [P] Add user_settings table with all columns per data-model.md in db/migrations/006_setting_preservation.sql
- [ ] T003 [P] Add preferred_location and location_context columns to relationships table in db/migrations/006_setting_preservation.sql
- [ ] T004 [P] Add parameterized setting template to context_templates seed data in db/migrations/006_setting_preservation.sql
- [ ] T005 Add purge_stale_settings() function in db/migrations/006_setting_preservation.sql
- [ ] T006 Add indexes (idx_user_settings_user, idx_user_settings_updated) in db/migrations/006_setting_preservation.sql
- [ ] T007 Apply migration and verify schema created successfully

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core modules that MUST be complete before user stories can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create compute/setting-preserver.js with module structure and imports per contracts/setting-preserver-api.md
- [ ] T009 [P] Implement loadUserSettings(userId) function in compute/setting-preserver.js
- [ ] T010 [P] Implement saveUserSettings(userId, preferences) function in compute/setting-preserver.js
- [ ] T011 [P] Implement loadPersonaLocation(userId, personaId) function in compute/setting-preserver.js
- [ ] T012 [P] Implement savePersonaLocation(userId, personaId, location) function in compute/setting-preserver.js
- [ ] T013 Implement compileUserSetting(userId, personaId, sessionId) function with template substitution in compute/setting-preserver.js
- [ ] T014 Add graceful error handling and operator_logs integration to compute/setting-preserver.js
- [ ] T015 Create compute/setting-extractor.js with SETTING_PATTERNS constants per contracts/setting-extractor-api.md
- [ ] T016 Implement extractSettingPreferences(messages) function in compute/setting-extractor.js
- [ ] T017 Implement confidence scoring logic in compute/setting-extractor.js
- [ ] T018 Implement extractAndSaveSettings(sessionData) function in compute/setting-extractor.js
- [ ] T019 Add graceful error handling and operator_logs integration to compute/setting-extractor.js

**Checkpoint**: Foundation ready - all core modules exist with their APIs

---

## Phase 3: User Story 1 - Returning to a Familiar Bar (Priority: P1) 🎯 MVP

**Goal**: Returning users experience personalized settings—the bar remembers their preferences from previous sessions.

**Independent Test**: Complete one session with stated preferences, return in new session, verify setting context includes personalized preferences instead of generic defaults.

### Tests for User Story 1

- [ ] T020 [P] [US1] Unit test for loadUserSettings() in tests/unit/setting-preserver.test.js
- [ ] T021 [P] [US1] Unit test for compileUserSetting() with preferences in tests/unit/setting-preserver.test.js
- [ ] T022 [P] [US1] Unit test for compileUserSetting() default fallback in tests/unit/setting-preserver.test.js

### Implementation for User Story 1

- [ ] T023 [US1] Update compute/context-assembler.js to import compileUserSetting from setting-preserver.js
- [ ] T024 [US1] Replace getSettingContext(sessionId) call with compileUserSetting(userId, personaId, sessionId) in compute/context-assembler.js
- [ ] T025 [US1] Ensure token budget enforcement (200 tokens) for compiled settings in compute/setting-preserver.js
- [ ] T026 [US1] Add backward compatibility fallback when user_settings table is empty in compute/setting-preserver.js
- [ ] T027 [US1] Integration test for full context assembly with personalized setting in tests/integration/setting-flow.test.js

**Checkpoint**: User Story 1 complete - returning users see personalized settings

---

## Phase 4: User Story 2 - Atmosphere Customization (Priority: P2)

**Goal**: Users can express atmosphere preferences during conversation, and these are captured at session end for future sessions.

**Independent Test**: User states "I prefer Fado music", session ends, new session begins with Fado in setting context.

### Tests for User Story 2

- [ ] T028 [P] [US2] Unit test for extractSettingPreferences() music patterns in tests/unit/setting-extractor.test.js
- [ ] T029 [P] [US2] Unit test for extractSettingPreferences() atmosphere patterns in tests/unit/setting-extractor.test.js
- [ ] T030 [P] [US2] Unit test for extractSettingPreferences() location patterns in tests/unit/setting-extractor.test.js
- [ ] T031 [P] [US2] Unit test for extractSettingPreferences() timeOfDay patterns in tests/unit/setting-extractor.test.js
- [ ] T032 [P] [US2] Unit test for confidence scoring threshold (<0.3 not saved) in tests/unit/setting-extractor.test.js

### Implementation for User Story 2

- [ ] T033 [US2] Update completeSession() in compute/context-assembler.js to import extractAndSaveSettings
- [ ] T034 [US2] Call extractAndSaveSettings(sessionData) after updateFamiliarity() in completeSession()
- [ ] T035 [US2] Add settings_extracted and settings_fields to session_complete log details in compute/context-assembler.js
- [ ] T036 [US2] Integration test for preference extraction at session end in tests/integration/setting-flow.test.js

**Checkpoint**: User Story 2 complete - atmosphere preferences captured automatically

---

## Phase 5: User Story 3 - Persona-Specific Environments (Priority: P3)

**Goal**: Each persona-user pair has a consistent meeting location within O Fim that persists across sessions.

**Independent Test**: User mentions "Hegel at the bar counter" in conversation, next Hegel invocation includes bar counter in setting context.

### Tests for User Story 3

- [ ] T037 [P] [US3] Unit test for savePersonaLocation() in tests/unit/setting-preserver.test.js
- [ ] T038 [P] [US3] Unit test for loadPersonaLocation() in tests/unit/setting-preserver.test.js
- [ ] T039 [P] [US3] Unit test for extractSettingPreferences() personaLocation patterns in tests/unit/setting-extractor.test.js

### Implementation for User Story 3

- [ ] T040 [US3] Extend compileUserSetting() to include persona location in setting text in compute/setting-preserver.js
- [ ] T041 [US3] Update extractAndSaveSettings() to call savePersonaLocation() when persona location detected in compute/setting-extractor.js
- [ ] T042 [US3] Integration test for persona-specific location persistence in tests/integration/setting-flow.test.js

**Checkpoint**: User Story 3 complete - persona locations persist per relationship

---

## Phase 6: User Story 4 - System Configuration Persistence (Priority: P3)

**Goal**: Operators can configure system-level settings (token budgets, drift thresholds) that persist across restarts.

**Independent Test**: Operator sets custom token budget in user_settings.system_config, verify new sessions use that budget.

### Tests for User Story 4

- [ ] T043 [P] [US4] Unit test for saveUserSettings() with system_config in tests/unit/setting-preserver.test.js
- [ ] T044 [P] [US4] Unit test for loadUserSettings() system_config retrieval in tests/unit/setting-preserver.test.js

### Implementation for User Story 4

- [ ] T045 [US4] Extend compileUserSetting() to read and apply system_config.token_budget if set in compute/setting-preserver.js
- [ ] T046 [US4] Export getSystemConfig(userId) helper for external modules in compute/setting-preserver.js
- [ ] T047 [US4] Integration test for system config persistence across restarts in tests/integration/setting-flow.test.js

**Checkpoint**: User Story 4 complete - operator configuration persists

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Data retention, documentation, and final validation

- [ ] T048 [P] Verify purge_stale_settings() correctly deletes records older than 90 days
- [ ] T049 [P] Add cron job documentation for daily purge_stale_settings() execution to quickstart.md
- [ ] T050 Verify all operator_logs entries for setting operations are correctly logged
- [ ] T051 Run full test suite (npm test) and fix any failures
- [ ] T052 Run quickstart.md validation steps to confirm feature works end-to-end
- [ ] T053 Update CLAUDE.md with 005-setting-preservation in Recent Changes section

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 → P2 → P3)
  - US3 and US4 are both P3, can run in parallel if desired
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2/US3

### Within Each User Story

- Tests SHOULD be written and FAIL before implementation
- Unit tests before integration tests
- Implementation completes tests
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T002, T003, T004 can run in parallel (different sections of same migration file)
- Phase 2: T009, T010, T011, T012 can run in parallel (different functions)
- Phase 3: T020, T021, T022 can run in parallel (different test cases)
- Phase 4: T028-T032 can run in parallel (different test cases)
- Phase 5: T037, T038, T039 can run in parallel (different test cases)
- Phase 6: T043, T044 can run in parallel (different test cases)
- Phase 7: T048, T049 can run in parallel (different concerns)

---

## Parallel Example: Foundational Phase

```bash
# Launch all preserver functions together (different functions, same file):
Task: "Implement loadUserSettings(userId) function in compute/setting-preserver.js"
Task: "Implement saveUserSettings(userId, preferences) function in compute/setting-preserver.js"
Task: "Implement loadPersonaLocation(userId, personaId) function in compute/setting-preserver.js"
Task: "Implement savePersonaLocation(userId, personaId, location) function in compute/setting-preserver.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration)
2. Complete Phase 2: Foundational (core modules)
3. Complete Phase 3: User Story 1 (personalized settings for returning users)
4. **STOP and VALIDATE**: Test that returning users see personalized settings
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Preference capture)
4. Add User Story 3 → Test independently → Deploy/Demo (Persona locations)
5. Add User Story 4 → Test independently → Deploy/Demo (Operator config)
6. Each story adds value without breaking previous stories

### Suggested MVP Scope

**Minimum Viable Product**: Phase 1 + Phase 2 + Phase 3 (User Story 1)

This delivers the core value: returning users experience a personalized O Fim. Atmosphere customization (US2), persona locations (US3), and operator config (US4) are additive enhancements.

---

## Notes

- [P] tasks = different files or different functions, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All errors must be graceful per Constitution II (Invisible Infrastructure)
