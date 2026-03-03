# Mobility & Recovery Knowledge

## Dynamic Stretching (pre-workout)
Use before training to prepare joints and muscles for movement. 5-10 minutes.
- Leg swings (front-back and side-to-side)
- Walking lunges with torso rotation
- Arm circles and shoulder pass-throughs
- Hip circles and deep bodyweight squats
- Inchworms / world's greatest stretch
- High knees and butt kicks

## Static Stretching (post-workout)
Use after training when muscles are warm. Hold each stretch 30-60 seconds.
- Hip flexor stretch (half-kneeling lunge)
- Hamstring stretch (seated or standing)
- Quad stretch (standing or lying)
- Calf stretch (wall lean)
- Chest doorway stretch
- Lat stretch (hanging or doorway)
- Pigeon pose (glutes/hip external rotation)

## Foam Rolling / Self-Myofascial Release
Roll each muscle group for 60-90 seconds. Pause on tender spots for 20-30s.
- IT band (lateral thigh)
- Quads and hip flexors
- Glutes and piriformis
- Calves and Achilles
- Upper back (thoracic spine)
- Lats

## Yoga Styles for Athletes
- **Vinyasa**: Dynamic flow linking breath with movement. Good for active recovery, flexibility, and body awareness. 30-60 min sessions.
- **Yin**: Long holds (3-5 min) in passive positions. Targets connective tissue and deep flexibility. Excellent for rest days.
- **Restorative**: Very gentle, supported poses. Pure recovery. Good after hard training blocks or during deload weeks.

## Active Recovery Sessions
- Light activity at <60% max HR for 20-40 minutes
- Easy walk, gentle swim, casual bike ride, yoga flow
- Purpose: promote blood flow for recovery without adding training stress
- Schedule on the day after the hardest workout of the week

## Mobility Routines by Sport
- **Runners**: Hip flexors, hamstrings, calves, IT band, thoracic spine rotation. 15-20 min.
- **Cyclists**: Hip flexors (shortened from bike position), hamstrings, lower back, neck/shoulders. 15-20 min.
- **Swimmers**: Shoulders (internal/external rotation), thoracic spine, lats, hip flexors. 15-20 min.
- **Strength athletes**: Hip mobility (deep squat holds), shoulder mobility, thoracic extension, ankle dorsiflexion. 10-15 min.

## Prescription Formats

**Mobility session** — with structured exercises:
```json
{
  "duration": "20min",
  "focus": "hips and hamstrings",
  "instructions": "Hold each stretch gently, breathe into the position",
  "exercises": [
    {"name": "Hip Flexor Stretch", "duration": "60s", "sets": 2, "notes": "each side", "description": "Half-kneeling lunge position, push hips forward"},
    {"name": "Foam Roll Quads", "duration": "90s"},
    {"name": "Pigeon Pose", "duration": "60s", "sets": 2, "notes": "each side", "description": "Front shin parallel to mat, fold forward"}
  ]
}
```

**Yoga**:
```json
{"duration": "30min", "style": "vinyasa", "focus": "hips and hamstrings", "instructions": "Focus on slow transitions and deep breathing throughout"}
```

**Active recovery**: `{"duration": "30min", "type": "active recovery", "notes": "Easy walk or gentle swim, keep HR below 60% max"}`
