## Potential features - To be decided

### Multi-Agent Grit - Planning Complete

The original brainstorm for multi-agent Grit has been refined into a concrete plan. After research and analysis, the approach is **conversation modes with dynamic context** rather than a full multi-agent system (which would add 4-15x token cost and 10-30s latency).

Implementation tasks: Task 18-24. Full plan: `.claude/plans/cosmic-twirling-horizon.md`

### Live recording screen fix

The design needs to be overhauled

### Remove time of day questions

### Check security of the app

grit should only have access to the current user enforced by the backend

Implement a guard agent for intent

### Improve Grit's questioning

sometimes he asks questions that were already answered

he asks unnecessary questions sometimes like for additional

he dumps a program overview in the chat rather than a proposal

maybe better explanations on what specifically he should do and implement sub agents for other calls?

experiment with subagents for each
