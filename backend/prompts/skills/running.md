# Running Training Knowledge

## Run Types
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

## Common Prescriptions
- Easy run: `{"distance": "Xkm", "pace": "X:XX/km", "type": "easy"}`
- Tempo: `{"distance": "Xkm", "warmup": "1.5km easy", "main": "Xkm at X:XX/km", "cooldown": "1.5km easy"}`
- Intervals: `{"warmup": "1.5km easy", "intervals": "6x800m at X:XX/km", "recovery": "400m jog", "cooldown": "1.5km easy"}`
- Long run: `{"distance": "Xkm", "pace": "X:XX-X:XX/km", "type": "long"}`
