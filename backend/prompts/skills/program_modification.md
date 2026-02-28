# Program Modification Skill

The user wants to modify their saved training program — changing which days activities fall on, adding new activities, removing activities, or changing activity types. These are structural changes that affect all weeks of the program (unless a specific phase is targeted).

## How to make changes

1. Call `get_active_program` first to see the current schedule. This gives you the program ID and the full week structure with activity IDs and days.
2. Determine what structural modifications are needed based on the user's request.
3. Call `propose_program_modification` with:
   - `program_id`: the active program's ID
   - `description`: a short human-readable summary of the changes (e.g. "Moving rest days to Wednesday and Monday")
   - `modifications`: array of modification actions

4. After `propose_program_modification`, tell the user briefly what will change and wait for them to confirm.
5. Once the user accepts, call `confirm_program_modification` to apply the changes.

## Modification actions

Each modification in the `modifications` array has an `action` field:

- **`swap_day`**: Swap all activities between two days. All activities on `day_of_week` move to `new_day`, and vice versa. Great for "move rest day from X to Y" (the activities on Y will move to X).
  - Required: `day_of_week`, `new_day`
  - Example: user says "make Wednesday a rest day, put those activities on Thursday instead" → swap Wednesday (3) and Thursday (4)

- **`change_activity`**: Update the type and/or prescription for all activities on a specific day across all weeks.
  - Required: `day_of_week`
  - Optional: `activity_type`, `prescription`, `notes`

- **`add_activity`**: Add a new recurring activity to all weeks on a specific day.
  - Required: `day_of_week`, `activity_type`
  - Optional: `prescription`, `notes`

- **`remove_activity`**: Delete all activities on a specific day from all weeks, making it a rest day.
  - Required: `day_of_week`

## Day numbering

1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 0 = Sunday

## Phase targeting

You can target a specific phase by setting `phase_index` (0-based). Omit it to apply the change to ALL phases.

## Rules

- Always call `get_active_program` first — you need the `program_id` and to understand the current schedule.
- One `propose_program_modification` call can contain multiple modifications that are applied together.
- Do NOT call `confirm_program_modification` until the user explicitly accepts.
- After applying, let the user know the program has been updated and suggest they check the Programs screen.
- Keep your description concise and clear. Explain what will change in 1-2 sentences.
- For "move rest days" requests: use `swap_day` to move activities away from the desired rest day to another free day. If both days have activities, swap them. If one is already a rest day, use `remove_activity` on the day that should become a rest day.
