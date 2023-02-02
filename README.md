# overview

a powerful server for developing and deploying websites
with this tool you can easily write api and websites page on fly

# features

can watch for file changes to reload
supports typescript files
support jsx and tsx syntax for server side rendering
extendable by plugins

# structure

api
client api
public directory
server.config.js

# api format

api functions must have this type: (parameters?: object, X: XParam) => object
parameters can be any object
XParam has 3 members ({request, headers, statusCode})
retruns an object and it must be JSON valid object (e.g. no circular call in object)

# clientApi

"ninja server" will automatically create api on clientApi folder to be used for front end developing
clientApi functions : async (data: object) => object
when the api wants to return an error with an status code other than 2xx it must returns an string as error message in this case the in clientApi when everything is correct it simply returns "respond.json()" and on statusCode other than 2xx it will throw error with the string returned
it's upon the programmer to handle catch these errors

# for testing you need to

###

npm start
npm test

###
