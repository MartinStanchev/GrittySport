# Gritty Fitness

Gritty Fitness is a cross-platform mobile application that provides AI-powered, personalized fitness coaching. The app pairs users with an AI agent named Grit, who creates holistic training programs tailored to the user’s primary sport, assesses progress after every workout, and dynamically adjusts future sessions based on real performance data.
A program in Gritty Fitness is not limited to a single activity. A swimming program, for example, will include swim sessions, dryland strength training, mobility work, and recovery days. Grit builds the full picture of what a user needs to improve at their sport.
Users can record workouts manually (with GPS tracking and heart rate monitor connectivity), or import them from Garmin devices and Apple Health. After every recorded or missed session, Grit reviews performance against the plan and initiates a conversation with the user to provide feedback, ask questions, and offer program adjustments.
The app is free to use with no monetization at this stage. Authentication is email and password only.

## Way of working

Tasks are split and defined in the @./tasks/ folder. Each task should completely develop a feature. 

When asked to develop a feature, refer to the task number in the folder.

The code should always be kept in good readable condition and best practices should be followed. After you implement a feature, invoke the code simplifier agent to go over the feature and check for any code that needs to be simplified, removed or deduplicated. This will help with technical debt. 

### Progress tracker

To track how much progress we've made, there is a @./PROGRESS.md file. After each implementation, update it with a very short summary of what you have implemented. This should be enough to tell other AI agents or developers what has happenend. Make sure to include any deviations from the tasks here, so that it is visible. The file should not become very big as this will fill the context of coding agents very quickly. 

## Rules

Always validate your code by:

* Writing and running tests
* Running the code simplifier agent
* running linters for both backend and frontend

** IMPORTANT ** 

This project is still a work in progress. When you are asked to refactor a feature and that means breaking how it works currently, you have to refactor the feature completely. There should be absolutely no backwards compatibility, because this will only introduce unnecessary code and logic that will make the project confusing and hard to maintain. You are an expert developer and you know better than to create confusing and unnecessary code. 

## Running Go and Go linter

Go is installed in Windows in `Files/Go/bin/go.exe`. 

In WSL in Ubuntu it is in `/usr/local/go`. The executable is in `/usr/local/go/bin/go`. This should be added in the PATH and accessible with simply `go`. 

The Golang linter - golangci-lint is also installed. Run it with `golangci-lint run` in WSL Ubuntu. It is located in `/home/marts/go/bin/golangci-lint`.