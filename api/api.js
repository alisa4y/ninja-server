require("dotenv").config()
const jwt = require("jsonwebtoken")

const users = [
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
module.exports = {
  login: ({ username, password }) => {
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
  },
  add: ({ username, password }, x) => {
    const { req } = x
    const token = req.headers["authorization"]?.split(" ")[1]
    try {
      const { username: u } = jwt.verify(token, process.env.SECRET_KEY)
      const user = users.find(({ username }) => u === username)
      if (user.auth === "admin") {
        if (users.some(({ username: u }) => u === username)) {
          x.statusCode = 409
          return {
            message: "username already exist",
          }
        } else {
          users.push({ username, password })
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
  },
}
