# Task 25: Ideas 
  
## User login and registration

We currently only support user registration and login with a password. I think this is kind of outdated and it would be better to support OTP, social SSO and pass keys. The app is still not in production so nobody would be affected by such an abrubt switch. How should we go about implementing this? This will be only a mobile app and people will be using it on mobile so a passkey will be a nice addition for ease of login. However we would probably want to have a large session anyways. Social registration or OTP via email registration should be the way to go as well, in case of switching of devices etc. 

## Redesign program view

Stich inspired design
Includes Grit predictions, we can run them when the week starts as a cron. Predicted weekly volume, km, etc

Monthly view - a calendar, monthly statistics. Icons for the scheduled workouts. 

## Manual program creation 

Redesign manual program creation. Include some basic concepts that we have from AI program gen, like the criteria that we have if it applies. Then the process should be easier and more interactive instead of plain text fields. Manual program creation should be for users that already know what they want to create

## bugs 

### Heart rate not shown before starting workout - working

### no heart rate option for indoor activities - working

### Remove notification subscription error on logout - working 

### Clicking a notification should lead to the place where the user can see the message

### Notification text should be short, not the whole Grit message

### 