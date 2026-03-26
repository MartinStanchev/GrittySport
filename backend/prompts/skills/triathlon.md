# Triathlon Training Knowledge

## Program Creation Guidance

### Criteria to skip
- `sport` — already known (triathlon). Instead, identify the race distance.
- `equipment` — ask specifically about: bike type, power meter, pool access, open water access, wetsuit.
- `strength_conditioning` — always include it for triathletes. Do not ask, just inform the user you will add 1-2 strength sessions per week.

### Additional questions
- What triathlon distance are you training for? (Sprint, Olympic, 70.3, Ironman)
- Do you have a specific race? If yes, when?
- What is your strongest and weakest discipline? (swim, bike, run)
- How much triathlon or multi-sport experience do you have?
- Do you have access to a pool for swim training? Open water?
- Do you have an indoor trainer for bike sessions?
- Have you done brick sessions before? (bike-to-run transitions)
- Do you know any of these benchmarks: CSS pace, FTP, recent 5K/10K time?

### Notes
- After loading this skill, also load `running`, `cycling`, and `swimming` when generating the program phases — their prescription formats are needed for each discipline.
- Triathlon training requires balancing three disciplines. The weakest discipline typically gets the most focus, but no discipline should be neglected.
- Brick sessions (bike immediately followed by run) are essential. Include at least one per week in the build phase.
- For Sprint/Olympic: 5-8 hours/week is typical. For 70.3: 8-12 hours. For Ironman: 12-20 hours.
- Strength training: full body, 2x/week in base, 1x/week in build/peak.
- Always include mobility — the training volume demands it.

---

## Race Distances
- **Sprint**: 750m swim, 20km bike, 5km run (~1-1.5 hours)
- **Olympic**: 1500m swim, 40km bike, 10km run (~2-3 hours)
- **70.3 (Half Ironman)**: 1900m swim, 90km bike, 21.1km run (~4.5-7 hours)
- **Ironman**: 3800m swim, 180km bike, 42.2km run (~9-17 hours)

## Weekly Structure Principles
- Train each discipline 2-4x/week depending on total volume and available time.
- Weakest discipline gets one extra session.
- Include one long session per discipline per week (rotating which day is longest).
- Include 1-2 brick sessions per week in build phase (bike-to-run is most important).
- Strength training: 2x/week in base, 1x/week in build, drop in peak/taper.
- One full rest day per week minimum.

## Brick Sessions
- **Purpose**: Train the bike-to-run transition. Legs feel heavy off the bike — this is trainable.
- **Structure**: Complete a bike session, then immediately transition to a run.
- **Base phase**: Short bricks (30min bike + 15min easy run).
- **Build phase**: Longer bricks (60-90min bike + 20-30min run at race pace).
- **Peak phase**: Race-simulation bricks (race-distance bike + shorter run at goal pace).
- **Prescription**: Use two activities on the same day — one Cycling and one Run — with a note indicating brick session.

## Discipline Balancing by Weakness
- **Weak swim**: Add one extra swim (technique-focused drill session). Reduce bike or run volume slightly.
- **Weak bike**: Add one extra indoor trainer session (structured intervals). Keep swim and run steady.
- **Weak run**: Add one extra easy run (off-the-bike if possible). Keep swim and bike steady.

## Phase Structure (Olympic distance example)
- **Base (4-6 weeks)**: Aerobic foundation in all three sports. Easy intensity. Technique drills for swim. Endurance rides. Easy runs.
- **Build (4-6 weeks)**: Introduce intensity. Threshold swim sets, sweet spot bike, tempo runs. Weekly bricks. Race-pace rehearsal.
- **Peak (2-3 weeks)**: Highest intensity. Race-pace intervals. Full-distance simulations. Reduce volume.
- **Taper (1-2 weeks)**: Reduce volume 40-50%. Short sharp efforts. Rest and recover.

## Transition Training
- T1 (swim-to-bike): Practice removing wetsuit quickly, mounting bike, clipping in. Include in race-simulation sessions.
- T2 (bike-to-run): Practice dismounting, racking bike, starting the run. The first km always feels heavy — brick sessions train this.
- In training, focus on T2 since it has the most physiological impact.

## Prescriptions
Triathlon programs use prescriptions from each individual sport skill:
- Swim prescriptions: CSS-based sets, drill sets (see `swimming` skill)
- Bike prescriptions: FTP-based zones, structured intervals (see `cycling` skill)
- Run prescriptions: pace-based, structured intervals (see `running` skill)
- Brick: prescribe as two activities on the same day (Cycling + Run), with notes indicating transition
