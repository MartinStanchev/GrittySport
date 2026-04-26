# Running Training Knowledge

## Program Creation Guidance

### Criteria to skip
- `equipment` — not applicable for running unless trail running (then ask about shoes/gear).
- `facility_access` — only ask if the user mentions track work or treadmill preference.

### Additional questions
- What distance or event are you training for? (5K, 10K, half marathon, marathon, ultra, or general running fitness)
- Do you have a target race date?
- What is your current weekly mileage (approximately)?
- Any history of running-related injuries? (shin splints, IT band, plantar fasciitis, etc.)

### Notes
- For beginners, skip the benchmarks question entirely and use RPE-based prescriptions. Do not ask for race times.
- For intermediate/advanced runners, ask for a recent race time or current easy/tempo pace — essential for calculating training zones.
- Always recommend cross-training with strength and mobility. Runners benefit significantly from hip/glute strengthening and mobility work.
- If the user mentions a race date, build a periodized plan with a taper. If no race, build an ongoing fitness plan.

---

## Run Types

All running sessions use `activity_type: "run"` (or `"indoor_run"` for treadmill). The session character is conveyed via the `notes` field and the structure of the `prescription`. Suggested notes labels: "Easy", "Tempo", "Intervals", "Long run", "Fartlek", "Hill repeats", "Strides", "Trail".

- **Easy/Recovery Run**: Conversational pace, 60-70% max HR. Foundation of any program. Should make up 80% of weekly mileage.
- **Tempo Run**: Comfortably hard, ~85% max HR. Sustainable for 20-40 min. Improves lactate threshold.
- **Interval Training**: Short repeats (200m-1600m) at VO2max effort (~90-95% max HR) with recovery jogs. Builds speed and aerobic power.
- **Long Run**: 1.5-2x the distance of a regular easy run. Slow pace. Builds endurance and fat oxidation.
- **Fartlek**: Unstructured speed play mixing easy and hard efforts. Good for beginners transitioning to structured speedwork.
- **Hill Repeats**: 60-90 second hard efforts uphill, jog down recovery. Builds strength and running economy.
- **Strides**: 80-100m accelerations at near-sprint pace. 4-6 reps after an easy run. Improves neuromuscular efficiency.

## Pacing Guidelines by Goal
- **5K**: Easy runs 60-90s/km slower than goal pace. Tempo at 15-20s/km slower than goal pace. Intervals at goal pace or 5-10s/km faster.
- **10K**: Easy runs 60-90s/km slower. Tempo at 10-15s/km slower. Intervals at 5K pace.
- **Half Marathon**: Easy runs 45-75s/km slower. Tempo at goal pace. Long runs at 30-60s/km slower.
- **Marathon**: Easy runs 45-75s/km slower. Tempo at 10-15s/km slower. Marathon-pace long runs for the last 30-40 min of long run.

## Mileage Progression
- **Beginner** (0-20 km/week): Start with run/walk intervals. Build to 3-4 continuous runs per week. Increase weekly distance by max 10%.
- **Intermediate** (20-50 km/week): 4-5 runs per week. One quality session (tempo or intervals) + one long run.
- **Advanced** (50-80+ km/week): 5-6 runs per week. Two quality sessions + long run. May add doubles.

## Taper for Races
- **5K/10K**: 1 week taper, reduce volume 30%, maintain 1-2 short speed sessions
- **Half Marathon**: 10-14 day taper, reduce volume 40%, 2 easy weeks with short tempo/strides
- **Marathon**: 2-3 week taper, reduce volume 50-60%, maintain 1 shorter tempo, lots of easy running

## Prescription Formats

**Simple runs** (easy, long, tempo, fartlek) — flat format:
```json
{"distance": "8km", "pace": "5:30/km", "effort": "Easy — 60-90s/km slower than 5K pace", "rpe": 6}
```

**Structured workouts** (intervals, hill repeats, strides) — use `sets` array:
```json
{
  "warmup": "1.5km easy",
  "sets": [
    {"reps": 6, "distance": "800m", "pace": "3:40/km", "effort": "5K goal pace", "rpe": 8, "rest": "400m jog"}
  ],
  "cooldown": "1.5km easy",
  "total_distance": "10km"
}
```

More examples:
- Hill repeats: `{"warmup": "1.5km easy", "sets": [{"reps": 6, "distance": "200m", "effort": "Hard uphill", "rpe": 8, "rest": "jog down"}], "cooldown": "1.5km easy"}`
- Strides after easy run: `{"distance": "8km", "pace": "5:30/km", "effort": "Easy with strides", "rpe": 6, "sets": [{"reps": 6, "distance": "100m", "effort": "Near-sprint", "rpe": 9, "rest": "60s walk"}]}`
- Tempo: `{"distance": "10km", "pace": "4:45/km", "effort": "Comfortably hard — 15-20s/km slower than 5K pace", "rpe": 7}`
- Long run: `{"distance": "16km", "pace": "6:00/km", "effort": "Easy — conversational throughout", "rpe": 6}`
