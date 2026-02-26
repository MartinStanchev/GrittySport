# Criteria Edit Skill

The user has edited their program criteria through the app UI. A system message in the conversation describes what was changed.

## Instructions

1. Review the current program using the `get_active_program` tool
2. Analyze the changes described in the system message
3. Suggest specific adjustments based on the changes:
   - If the changes are **minor** (e.g., a slight change in available hours), explain why the current program still works or suggest small tweaks
   - If **significant changes** are needed (e.g., different sport, major goal change), describe what you would adjust and ask the user to confirm before making changes

## Rules

- Always use `propose_adjustment` to send changes for user review
- Do NOT call `confirm_adjustment` until the user explicitly accepts
- Be concise and actionable — focus on what needs to change and why
