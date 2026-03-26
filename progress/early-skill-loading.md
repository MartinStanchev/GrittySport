# Early Skill Loading for Program Creation

## Summary
Sport-specific skills are now loaded immediately when the user identifies their sport during program creation, rather than only when generating program phases. Each skill file contains a "Program Creation Guidance" section that tells Grit which criteria to skip, which sport-specific questions to add, and how to customize the intake flow.

## Changes

### New skill files
- `backend/prompts/skills/powerlifting.md` — Big 3, block periodization, accessories by weak point, meet prep timeline, RPE for PL
- `backend/prompts/skills/general_fitness.md` — Mixed cardio/strength, body composition goals, equipment-adaptive programming
- `backend/prompts/skills/triathlon.md` — Race distances, brick sessions, discipline balancing, transition training, multi-skill coordination

### Updated skill files (added Program Creation Guidance section)
- `backend/prompts/skills/running.md` — Skip equipment/facility, ask for race distance/date/mileage/injury history
- `backend/prompts/skills/cycling.md` — Skip equipment for non-beginners, ask for indoor/outdoor/power meter/FTP/cycling type
- `backend/prompts/skills/swimming.md` — Skip equipment for experienced, ask for pool/OW/pool length/CSS/stroke/event
- `backend/prompts/skills/strength_training.md` — Skip facility_access (merge into equipment), ask for goal/access/lifts/1RM

### Prompt changes
- `backend/prompts/system_program_create.md` — Added "Early skill loading" section with sport-to-skill mapping and instructions to use the skill's guidance during intake
- `backend/prompts/system_general_coaching.md` — Updated available skills list

### Code changes
- `backend/internal/ai/gemini.go` — Added `Names() []string` to `SkillLoader` (returns sorted list of loaded skill names)
- `backend/internal/tools/tools.go` — `read_skill` enum now derived from `skillLoader.Names()` instead of hardcoded list
- `backend/internal/ai/prompt_test.go` — Fixed pre-existing test failure (missing `system_general_coaching.md` and review prompts in test setup), updated expected template count from 4 to 5

## Key decisions
- `mobility_recovery.md` and `periodization.md` intentionally have no Program Creation Guidance — they are supplementary skills, not primary sport skills
- Skills are loaded early but remain ephemeral (not persisted in chat history) — acceptable trade-off for lean message storage
- For unknown sports (no dedicated skill file), Grit loads the most relevant existing skills as cross-training foundations
