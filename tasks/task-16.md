## Potential features - To be decided

### Multi-agent Grit

1 Agent orchestrates 

Sub agents create specific programs based on the skills that we defined. They will get passed the user's info and give some activities planned 

Orchestrator collects these and creates the actual plan 

Separate agent does reviews

Sub agent does edits if needed

Guard agent detects malicious intent

Maybe a entry point agent tries to discover intent and then passes the message to the orchestrator? This entry point agent can identify and load memories for Grit. It can also load up other things automatically

Standardize the LLM output into a JSON. Include actions, questions, user visible text etc in separate fields.

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