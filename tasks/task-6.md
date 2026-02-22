## Feature 5 Improvements

### Goal

We need to improve the user experience for the conversational program creation. 

1. We should introduce a better visual experience while chatting with Grit. Grit asks a predefined set of questions, this should be increased and configurable. Lets extract the questions to a JSON file that we will load into the API on startup and pass it in the system prompt. Lets also extract the system prompt to a separate file so that it is easily readable and editable. 

2. We should ask Grit to only ask 1 question at a time from his predefined questions. This will help the user in typing in the responses. 

3. We should allow markdown formatting in the chat for a better visual experience

4. We should add a yes/no buttons above the chat when Grit asks a yes or no questions. The users should also obviously be able to chat instead. 

5. Grit should always ask about and suggest strength and conditioning as well as stretching. Better yet, we can make Grit ask the user if they want to add some other types of training in their program. If a user is training for a climbing event, they might also like doing yoga, so they would want that in their program. Another example is endurance atheletes - they still need strength training here and there. 

6. Streaming in the chat doesn't seem to work properly. The responses might be streamed from the Google API, but not in the chat in the UI. We should fix that.

7. Every time the user opens the chat all previous messages are in it. We should clear the chat when the user closes the app (not the chat itself). Not sure how we can detect that, but we should figure out a way to clear it. We should also add a clear chat button somewhere. That button needs to be nice and with a good user experience. 

7.1 On each chat context clear, we should summarize the context with a cheap fast model. Then this summary can be saved for the user as a long term memory that should be loaded in the beginning when chatting to Grit.

8. We should pass the current time and date to Grit in the system prompt.

9. We should have a button or allow the keyboard to close while in the Grit chat, so that the text is more visible.
