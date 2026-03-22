# Cycling Training Knowledge

## Power Zones (based on FTP)
- **Zone 1 (Active Recovery)**: <55% FTP. Very easy spinning.
- **Zone 2 (Endurance)**: 56-75% FTP. All-day pace. Foundation training.
- **Zone 3 (Tempo)**: 76-90% FTP. Sustainable hard effort, 20-60 min.
- **Zone 4 (Threshold/FTP)**: 91-105% FTP. Race pace for 40K TT. Sustainable 20-40 min.
- **Zone 5 (VO2max)**: 106-120% FTP. Hard intervals, 3-8 min repeats.
- **Zone 6 (Anaerobic)**: >120% FTP. Short, very hard efforts, 30s-2 min.

## FTP Training
- **FTP test**: 20-minute all-out effort, multiply average power by 0.95. Or ramp test.
- **Sweet spot training**: 88-93% FTP. Efficient way to build FTP with manageable fatigue. 2x20 min is a classic session.
- **Threshold intervals**: 2x20, 3x15, or 4x10 at 95-105% FTP.
- **VO2max intervals**: 4-6x4 min at 106-120% FTP with 3-4 min recovery.

## Session Types
- **Endurance ride**: 1-4 hours in Zone 2. Foundation of cycling fitness.
- **Sweet spot**: Warm up → 2x20 min at 88-93% FTP → cool down. Best bang for buck.
- **Threshold**: Warm up → 2x20 min at FTP → cool down. Race-specific fitness.
- **VO2max intervals**: Warm up → 5x4 min at 106-120% FTP, 3 min recovery → cool down.
- **Hill repeats**: Find a 5-8 min climb, repeat 3-6 times at threshold+. Builds climbing strength.
- **Sprint intervals**: 6-10x30s all-out with 4-5 min recovery. Anaerobic power.

## Indoor vs Outdoor
- Indoor (trainer): More controlled, time-efficient, easier to hit power targets. RPE feels harder — reduce duration by 20% vs outdoor.
- Outdoor: More varied terrain, better bike handling, more fun. Use RPE or HR if no power meter.
- Cadence targets: 85-95 RPM for most riding. Low cadence (60-70) for strength work. High cadence (100-110) for efficiency drills.

Ask the user whether they prefer Indoor or Outdoor and include a mix of those if requested. If the user doesn't mind, you can suggest they can choose to do a session either ways.  

## Weekly Structure (Example: 4 days)
- Day 1: Endurance ride (Zone 2, longest ride of the week)
- Day 2: Rest or cross-training
- Day 3: Threshold/sweet spot intervals
- Day 4: Rest
- Day 5: VO2max or hill repeats
- Day 6: Recovery spin or rest
- Day 7: Group ride or endurance

## Prescription Formats

**Endurance rides** — flat format:
```json
{"duration": "2h", "intensity": "Zone 2", "cadence": "85-95 RPM", "effort": "Easy endurance, conversational", "rpe": 6}
```

**Structured workouts** (sweet spot, threshold, VO2max, sprints) — use `sets` array:
```json
{
  "warmup": "15min Zone 2",
  "sets": [
    {"reps": 2, "duration": "20min", "intensity": "88-93% FTP", "effort": "Sweet spot", "rpe": 7, "rest": "5min easy"}
  ],
  "cooldown": "10min easy"
}
```

More examples:
- VO2max: `{"warmup": "15min progressive", "sets": [{"reps": 5, "duration": "4min", "intensity": "106-120% FTP", "effort": "VO2max — very hard", "rpe": 9, "rest": "3min easy"}], "cooldown": "10min easy"}`
- Sprints: `{"warmup": "20min Zone 2", "sets": [{"reps": 8, "duration": "30s", "intensity": "all-out", "effort": "Maximum sprint", "rpe": 10, "rest": "4min easy"}], "cooldown": "10min easy"}`
- Threshold: `{"warmup": "15min Zone 2", "sets": [{"reps": 2, "duration": "20min", "intensity": "95-105% FTP", "effort": "Threshold — sustainable hard", "rpe": 8, "rest": "5min easy"}], "cooldown": "10min easy"}`
