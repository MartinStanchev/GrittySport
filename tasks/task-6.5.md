## Task 6 bug fixed

### Goal

We need to improve the user experience for the conversational program creation. 

1. yes or no options appear on a lot of prompts. This should not be the case. We need better detection for when a question is yes or no. We can ask Grit to output his questions to the user in a special JSON that we can parse. In that JSON, Grit can give 2 predetermined by him responses. We can then show those responses in a nice responsive UI in the chat. The user can of course not go with them and simply chat. So this would require us to change our questions format. Instead of the current JSON format, let's just have a list of criteria instead of specific questions that Grit will ask. We should explain to Grit what these questions mean and he will then choose what to ask in order to fulfil the criteria. 

2. The keyboard is nicer now, however it looks like we've disabled some settings. The autocomplete and auto capitaization is off. Is that a setting that we've turned off or something to do with the keyboard? Can we reenable them, but keep the current option to hide the keyboard and everything else?



