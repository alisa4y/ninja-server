# overview

a powerful server for developing and deploying websites
with this tool you can easily write api and websites page on fly

# features at glance

generate webpages from public folder(can be configured)
can watch for file changes to reload
supports typescript files
support jsx and tsx syntax for server side rendering
extendable by plugins

# folder structure

api
client api
public directory
server.config.js

# api folder

`ninja server` will read through all api directory and create urls at the directory structure and `require` the ts or js files
it expects the exports in these files to be whether a function or an object
then it will generate urls depends on the names of these exports
for example if api has a file named users.js and it exports login function
it will generate a path like `/users/login`
each of these function can get 2 parameters the 1st is an object which is passed by the request and the other is XCon
if an export is an object then it destructure it further and create urls from it
for example if users.js was

```
export const api = {
  login: (data, x) => {}
}
```

the generated path would be `/users/api/login` so be careful in naming

api functions must have this type: (parameters?: object, X: XCon) => object | string
parameters can be any object
XCon has 3 members ({request, headers, statusCode})
retruns an object and it must be JSON valid object (e.g. no circular call in object) when the operation is succeed (statusCode with 2xx)
otherwise must return an string explaining what was gone wrong

# api parameters

the parameters can be whether from url query or post body depends on method of request
with request method of "GET" , "DELETE" it will try to parse the url query then to json
with request method of "POST" , "PUT" it will try to get it from request's body and then convert it to json then pass it to api

# clientApi

`ninja server` will automatically create api on clientApi folder to be used for front end developing
clientApi functions : async (data: object) => object
when the api wants to return an error with an status code other than 2xx it must returns an string as error message in this case the in clientApi when everything is correct it simply returns "respond.json()" and on statusCode other than 2xx it will throw error with the string returned
it's upon the programmer to handle catch these errors

# for testing you need to

# using jsx or tsx

`ninja server` supports jsx and tsx syntax to generate webpage at compile(I know) or run time
it expects to get a function named "index" from these files so if it not exist it will skip it
the returned index function if it won't get any parameter then it assume its static so will be executed it at once
otherwise it executes it each time a request to that page url is made and its parameters is evaluated like an api

notice on using tsx you must add the following config to tsconfig.json

```
{
  "compilerOptions": {
    "jsx": "preserve"
  },
  "include": [
    "public/**/*.tsx",
  ],
}
```

you should change public folder to your configured folder

###

npm start
npm test

###
