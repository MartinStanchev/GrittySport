# Powerlifting Training Knowledge

## Program Creation Guidance

### Criteria to skip
- `strength_conditioning` — strength training IS the sport. Do not ask.
- `complementary_activities` — skip unless the user brings it up. Powerlifting training is already time-intensive.
- `facility_access` — a powerlifter needs a gym with a rack, bench, and barbell. Confirm briefly but do not make it a full question.
- `equipment` — skip for intermediates and above. For beginners, briefly confirm they have access to a barbell setup.

### Additional questions
- Do you compete or plan to compete? If yes, when is your next meet?
- What are your current 1RM or estimated 1RM for squat, bench press, and deadlift?
- Do you have any weak points you want to address? (lockout, off the chest, off the floor, depth, etc.)
- What is your current body weight and weight class (if competing)?
- Raw or equipped? (belt only vs wraps/suit)

### Notes
- For beginners (< 1 year of consistent lifting), use a linear progression approach. Do not overcomplicate with advanced periodization.
- For intermediate and advanced lifters, periodized blocks (hypertrophy, strength, peaking) are essential.
- Always ask for 1RM or working weights — prescriptions are percentage-based.
- Competition prep requires a peaking and taper phase. Work backwards from the meet date.
- Always recommend stretching/mobility — especially hip and shoulder mobility. Do not ask if they want it, include it by default.

---

## The Big 3
- **Squat**: Back squat is the competition lift. Variations: pause squat, tempo squat, pin squat, front squat (accessory).
- **Bench Press**: Competition bench with pause. Variations: close-grip, Spoto press, floor press, larsen press.
- **Deadlift**: Conventional or sumo (lifter preference). Variations: deficit deadlift, block pull, pause deadlift, Romanian deadlift.

## Programming Approaches
- **Linear Progression** (beginners): Add 2.5kg per session. Squat and deadlift 2-3x/week, bench 2-3x/week. Run until stalling.
- **Block Periodization** (intermediate+): 3-5 week blocks cycling through hypertrophy (60-70% 1RM, 8-12 reps), strength (75-85% 1RM, 3-6 reps), and peaking (85-100% 1RM, 1-3 reps).
- **Daily Undulating Periodization (DUP)**: Vary rep ranges within the week (e.g., Mon heavy 3x3, Wed moderate 4x6, Fri light 3x8).

## Rep/Set Schemes by Phase
- **Hypertrophy** (off-season): 3-4 sets of 8-12 reps at 60-70% 1RM. More accessory volume.
- **Strength** (build): 4-5 sets of 3-6 reps at 75-85% 1RM. Moderate accessories.
- **Peaking** (pre-meet): 3-5 sets of 1-3 reps at 85-95% 1RM. Minimal accessories. Reduce volume week-over-week.
- **Deload/Taper**: 40-50% volume reduction, maintain intensity at 70-80% 1RM.

## Common Accessories by Weak Point
- **Squat**: Pause squats (depth/positioning), leg press (quad strength), good mornings (posterior chain), belt squats.
- **Bench**: Close-grip bench (lockout), Spoto press (off the chest), dumbbell press (pec strength), tricep extensions (lockout).
- **Deadlift**: Deficit deadlift (off the floor), block pulls (lockout), barbell rows (upper back), front squats (quad/core).

## Meet Prep Timeline
- **12+ weeks out**: Hypertrophy/strength block. Build work capacity.
- **8-6 weeks out**: Strength block. Increase intensity, moderate volume.
- **4-2 weeks out**: Peaking block. High intensity, low volume. Practice competition lifts.
- **1 week out**: Deload. Very light training. Openers only. Rest and recover.
- **Meet week**: Hit openers at RPE 7-8 in final sessions. Full rest 2-3 days before.

## RPE for Powerlifting
- **RPE 6-7**: Warm-up and back-off sets. Used for volume accumulation.
- **RPE 8**: Main working sets in strength phase. Could do 2 more reps.
- **RPE 9**: Heavy singles and doubles in peaking. Could do 1 more rep.
- **RPE 10**: Competition attempts and max testing only. Never in regular training.

## Scheduling
- **3 days/week**: Squat/Bench/Deadlift — one main lift per day with relevant accessories.
- **4 days/week**: Upper/Lower or Squat-Bench / Deadlift-Bench split. Each main lift trained 1.5-2x/week.
- **5 days/week**: DUP or Squat/Bench/Deadlift/Upper accessories/Lower accessories.
- Never program heavy squats and heavy deadlifts on consecutive days.

## Prescriptions
- Competition squat: `{"exercises": [{"name": "Back Squat", "sets": 5, "reps": 3, "weight": "140kg", "effort": "82.5% 1RM", "rpe": 8, "rest": "4min"}]}`
- Bench with accessories: `{"exercises": [{"name": "Bench Press", "sets": 4, "reps": 5, "weight": "95kg", "effort": "80% 1RM", "rpe": 8, "rest": "3min"}, {"name": "Close-Grip Bench", "sets": 3, "reps": 8, "weight": "75kg", "effort": "65% 1RM", "rpe": 7, "rest": "2min"}, {"name": "Tricep Pushdown", "sets": 3, "reps": 12, "rpe": 7, "rest": "90s"}]}`
- Deadlift day: `{"exercises": [{"name": "Deadlift", "sets": 4, "reps": 3, "weight": "180kg", "effort": "85% 1RM", "rpe": 8, "rest": "5min"}, {"name": "Deficit Deadlift", "sets": 3, "reps": 5, "weight": "140kg", "effort": "70% 1RM", "rpe": 7, "rest": "3min"}, {"name": "Barbell Row", "sets": 3, "reps": 8, "weight": "80kg", "rpe": 7, "rest": "2min"}]}`
