## Feature 9: Activity tracking improvements - Heart rate sensor and post-activity summary

We have a few improvements to add to the activity tracking and post-workout summary that will make this app world class. We need to style them nicely and follow our existing user friendly design and experience. Research how these things are done in other apps, so that we bring fully fletched out features.

### Connect to heart rate sensor screen 

We currently have the button to connect to a heart rate sensor but it does not allow bluetooth connection yet. 

We should build the bluetooth connection option in two places - Settings and in the Record activity screen where we currently have the button.

This should be a common screen that we will use in both places. We should style it nicely, keeping up with the rest of the design in the app. 

### Heart rate tracking during workouts

We must show the current and average heart rate readings during the recording activity in separate cells, like we do for speed and pace. In addition to that we should add an additional way to see these metrics while doing the activity. We should make the component that shows the metrics during live activity swipeable. When the user swipes to the right, we should show a graph with the heart rate. The X axis will be time and Y axis is heart rate reading. The user should be able to switch between both. 

### Heart rate data in the workout summary

During tracking we should save all the heart rate readings that we have. Then in the summary we should build nice statistics and metrics for the user. We should have graphs for the heart rate during the activity, a graph for the pace or speed during the activity and we should also track things like cadence. These should obviously be sport specific. For running we would prefer pace and for cycling speed. For swimming we should have time/100 meters. 
