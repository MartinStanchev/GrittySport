# Swimming Training Knowledge

## Key Concepts
- **CSS (Critical Swim Speed)**: Threshold pace, similar to FTP in cycling. Test: (400m time - 200m time) / 2 = pace per 100m. Train at CSS ± 5s for threshold work.
- **Stroke rate vs distance per stroke**: Beginners should focus on DPS (fewer, longer strokes) before increasing rate.
- **Pool vs Open Water**: Pool allows precise intervals and pacing. Open water adds sighting, drafting, and navigation skills.

## Session Structure
- **Warm-up** (400-800m): Easy swim, include drill work and kick sets.
- **Pre-set/drill** (200-400m): Technique-focused. Catch-up drill, fingertip drag, single-arm, sculling.
- **Main set** (1000-2000m): The quality work — threshold, VO2max, or endurance sets.
- **Cool-down** (200-400m): Easy swimming, alternate strokes.

## Set Types
- **Endurance**: 4-8x200m at CSS+5s with 20s rest. Builds aerobic base.
- **Threshold/CSS**: 5x200m at CSS pace with 15-20s rest. Or 10x100m at CSS with 10s rest.
- **VO2max/Speed**: 8x50m at CSS-5s with 30s rest. Or 4x100m at near-max with 60s rest.
- **Kick set**: 4-6x50m kick with board, 15s rest. Builds leg strength and body position.
- **Pull set**: 200-400m pull with paddles and pull buoy. Builds upper body strength.
- **Descend set**: Each repeat faster than the last (e.g., 4x100m descend 1-4).

## Stroke Drills
- **Catch-up drill**: One arm stays extended until the other completes a full stroke. Teaches timing and extension.
- **Fingertip drag**: Drag fingertips along the water surface during recovery. Promotes high elbow recovery.
- **Single-arm drill**: Swim with one arm only, other arm extended. Isolates catch and pull mechanics.
- **Sculling**: Small figure-8 motions with hands at various positions. Develops feel for the water.
- **Kick on side**: Kick in side position, bottom arm extended, top arm at side. Teaches rotation and streamline.

## Dryland for Swimmers
- Band pull-aparts and resistance band pulls (mimic catch/pull phases)
- Core work: planks, flutter kicks, hollow body holds
- Shoulder stability: Y-T-W raises, external rotations
- Lat pulldowns and cable rows for pull strength

## Weekly Structure (Example: 4 sessions)
- Day 1: Technique + endurance (drills + long aerobic set)
- Day 2: Threshold (CSS intervals)
- Day 3: Speed/VO2max (short, fast repeats)
- Day 4: Mixed (kick, pull, IM, open water skills)

## Prescription Format

Always use structured `sets` array format:
```json
{
  "warmup": "400m easy",
  "sets": [
    {"reps": 4, "distance": "50m", "type": "drill", "description": "catch-up drill", "rest": "15s"},
    {"reps": 10, "distance": "100m", "pace": "1:45/100m", "rest": "10s"}
  ],
  "cooldown": "200m easy",
  "total_distance": "2500m"
}
```

Set `type` field values: `"drill"`, `"kick"`, `"pull"`, `"swim"` (default if omitted).

More examples:
- Threshold: `{"warmup": "500m easy", "sets": [{"reps": 10, "distance": "100m", "pace": "CSS", "rest": "10s"}], "cooldown": "300m easy", "total_distance": "2500m"}`
- Drills + main: `{"warmup": "400m easy", "sets": [{"reps": 4, "distance": "50m", "type": "drill", "description": "catch-up drill", "rest": "15s"}, {"reps": 4, "distance": "50m", "type": "drill", "description": "fingertip drag", "rest": "15s"}, {"reps": 8, "distance": "50m", "pace": "descend 1-4", "rest": "15s"}], "cooldown": "200m easy", "total_distance": "1500m"}`
