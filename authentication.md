adding authentication on the front end
also enables db connections. 

steps
- auth pages front end, build login buttons
- handler functions, passed from auth controller to the component
    - onclick takes the credentials and sends to the backend 
    - auth on the frontend needs protected routes, use JWT
    - frontend requests a jwt from the backend and stores it in localstorage or cookies?? 
    - frontend awaits the backend to check 
- build backend auth check api endpoint 
- backend has a app.use authcontroller for the /api/auth route
- the auth controller takes in the request and checks credentials against the DB
- if credentials match, return success and a jwt, else return an error invalid credentials

- back on the front end, if successful, receive the jwt, login the user, and also redirect them to home page / chat page
- 


#todo later
 - add conversation history
 - 