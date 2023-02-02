import { unlinkSync, writeFileSync } from "fs"
import { join } from "path"
import { XCon } from "../src/index"
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
export function login(
  { username, password }: Omit<User, "auth">,
  x: XCon
):
  | {
      token: string
      message: string
    }
  | string {
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
  else return x.error(400, "username or password is wrong")
}
export const add = ({ username, password, auth }: User, x: XCon) => {
  const { request: req } = x
  const token = req.headers["authorization"]?.split(" ")[1]
  try {
    const { username: u } = jwt.verify(token, process.env.SECRET_KEY)
    const user = users.find(({ username }) => u === username)
    if (user?.auth === "admin") {
      if (users.some(({ username: u }) => u === username)) {
        return x.error(409, "username already exist")
      } else {
        users.push({ username, password, auth })
        return {
          message: "successfully added",
        }
      }
    } else {
      return x.error(403, "you don't have permission to add user")
    }
  } catch (e) {
    return x.error(401, "not authorized")
  }
}
export function greet() {
  return { msg: "hi" }
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
      return { msg: "created" }
    case "delete":
      try {
        unlinkSync(join(process.cwd(), "public/runtime/index.html"))
      } catch (e) {}
      return { msg: "deleted" }
  }
}
const apiStr = (msg = "hello there") => `export function sayHi() {
  return { msg: "${msg}" }
}`
export function changeApiAtRuttime({ msg }: { msg: string }) {
  writeFileSync(join(process.cwd(), "./api/greet.ts"), apiStr(msg), "utf-8")
}
