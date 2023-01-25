import { unlinkSync, writeFileSync } from "fs"
import { join } from "path"
import { XParam } from "../src/index"
require("dotenv").config()
const jwt = require("jsonwebtoken")

type User = {
  username: string
  password: string
  auth: "admin" | "standard"
}

let users: User[] = [
  {
    username: "ali",
    password: "1111",
    auth: "admin",
  },
  {
    username: "tom",
    password: "pass1234",
    auth: "standard",
  },
]
const init = JSON.stringify(users)
export function reset() {
  users = JSON.parse(init)
}
export function login({ username, password }: Omit<User, "auth">): {
  token?: string
  message: string
} {
  const exist = users.some(({ username: u, password: p }) => {
    return u === username && p === password
  })
  if (exist)
    return {
      token: jwt.sign({ username }, process.env.SECRET_KEY, {
        expiresIn: "2h",
      }),
      message: "logged in successfully",
    }
  else
    return {
      message: "username or password is wrong",
    }
}
export const add = ({ username, password, auth }: User, x: XParam) => {
  const { req } = x
  const token = req.headers["authorization"]?.split(" ")[1]
  try {
    const { username: u } = jwt.verify(token, process.env.SECRET_KEY)
    const user = users.find(({ username }) => u === username)
    if (user?.auth === "admin") {
      if (users.some(({ username: u }) => u === username)) {
        x.statusCode = 409
        return {
          message: "username already exist",
        }
      } else {
        users.push({ username, password, auth })
        return {
          message: "successfully added",
        }
      }
    } else {
      x.statusCode = 403
      return {
        message: "you don't have permission to add user",
      }
    }
  } catch (e) {
    x.statusCode = 401
    return {
      message: "not authorized",
    }
  }
}
export function greet() {
  return "hi"
}
export function manipulateRuntimeIndex({ action }: { action: string }) {
  switch (action) {
    case "create":
      writeFileSync(
        join(process.cwd(), "public/runtime/index.html"),
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>runtime</title>
  </head>
  <body>
    <h1>created and got added at runtime</h1>
  </body>
</html>
      `,
        "utf-8"
      )
      return "created"
    case "delete":
      try {
        unlinkSync(join(process.cwd(), "public/runtime/index.html"))
      } catch (e) {}
      return "deleted"
  }
}
