# General Fitness Training Knowledge

## Program Creation Guidance

### Criteria to skip
- `event_date` — general fitness programs are ongoing, no competition date.
- `benchmarks` — not needed for general fitness. Use RPE throughout.
- `goal_target` — reframe: ask what success looks like (feeling stronger, losing weight, more energy, fitting into clothes).
- `strength_conditioning` — the program IS a mix of activities. Decide based on the user's preferences and goals instead of asking.
- `complementary_activities` — same as above; decide based on what the user enjoys.

### Additional questions
- What types of exercise do you enjoy or want to try? (running, cycling, swimming, gym, classes, home workouts, walking)
- Do you have a weight loss or body composition goal?
- Are there activities you specifically want to avoid?
- Do you have access to a gym, home equipment, or bodyweight only?
- How active is your daily life outside of workouts? (sedentary job, active job, walks regularly)

### Notes
- General fitness programs should be varied and enjoyable — sustainability is the priority over optimization.
- Mix cardio and strength. A typical split: 2-3 strength sessions + 2-3 cardio sessions per week, but this should be sustainable for the user.
- For weight loss goals, emphasize consistency and progressive overload. Do not prescribe extreme approaches.
- For beginners, start with 3 days/week and build up. Full-body strength + easy cardio is the best starting template.
- Equipment access is critical — ask early and adapt exercises accordingly.
- Always include mobility work — general fitness users often have tight muscles from sedentary lifestyles. Do not ask, include it by default.

---

## Program Structure
- **Beginner (0-3 months)**: 3 days/week. Full-body strength + light cardio. Focus on movement quality and habit building.
- **Intermediate (3-12 months)**: 4-5 days/week. Split strength training + dedicated cardio sessions. Progressive overload.
- **Maintained/Ongoing**: 4-6 days/week. Balanced mix of strength, cardio, and mobility. Periodize in 4-week cycles.

## Cardio Options
- Walking (30-60min, low impact, great for beginners and active recovery)
- Jogging/Running (easy pace, 20-40min, builds aerobic base)
- Cycling (indoor or outdoor, 30-60min, low joint stress)
- Swimming (full body, low impact, 30-45min)
- HIIT (high intensity interval training, 15-25min, 2x/week max)
- Group classes (spin, aerobics, dance — good for motivation)

## Strength for General Fitness
- Full-body compound movements: squat, deadlift, bench/push-up, row/pull-up, overhead press
- 2-3 sets of 8-12 reps per exercise at RPE 7-8
- Progressive overload: increase weight or reps every 1-2 weeks
- For home workouts: bodyweight squats, lunges, push-ups, dumbbell rows, plank

## Weekly Templates

**3 days/week (beginner)**:
- Day 1: Full-body strength (40-50min)
- Day 2: Cardio of choice (30-40min)
- Day 3: Full-body strength + short cardio (50-60min)

**4 days/week (intermediate)**:
- Day 1: Upper body strength
- Day 2: Cardio (steady state or HIIT)
- Day 3: Lower body strength
- Day 4: Cardio + core/mobility

**5 days/week**:
- Day 1: Upper strength
- Day 2: Lower strength
- Day 3: Cardio
- Day 4: Full body / functional
- Day 5: Cardio + mobility

## Prescriptions
- Strength: `{"exercises": [{"name": "Goblet Squat", "sets": 3, "reps": 12, "weight": "16kg", "rpe": 7, "rest": "90s"}, {"name": "Dumbbell Row", "sets": 3, "reps": 10, "weight": "12kg", "rpe": 7, "rest": "60s", "notes": "each arm"}, {"name": "Push-ups", "sets": 3, "reps": 10, "rpe": 7, "rest": "60s"}, {"name": "Plank", "sets": 3, "duration": "30s", "rpe": 6}]}`
- Cardio: `{"duration": "30min", "effort": "Easy — conversational pace", "rpe": 5, "notes": "Walk, jog, bike, or swim — your choice"}`
- HIIT: `{"warmup": "5min easy", "sets": [{"reps": 6, "duration": "30s", "effort": "All-out", "rpe": 9, "rest": "90s easy"}], "cooldown": "5min easy"}`
