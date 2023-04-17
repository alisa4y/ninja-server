const waitTime = 500

describe("server structure", () => {
  it("provides default file field in configuration as main page when entering url of website", () => {
    cy.visit("localhost:3000")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running the server with easy css change")
  })
  it("creates multiple address of the same html file in a folder using index.html as its refrence", () => {
    cy.visit("localhost:3000")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running the server with easy css change")

    cy.visit("localhost:3000/home")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running the server with easy css change")

    cy.visit("localhost:3000/home.html")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running the server with easy css change")

    cy.visit("localhost:3000/home/index.html")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running the server with easy css change")
  })
  it("creates urls of public directory till it reaches the index.html", () => {
    cy.visit("localhost:3000/home")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running the server with easy css change")

    cy.visit("localhost:3000/user/login")
    cy.get("form legend").contains("login:")
    cy.get("form button#post").contains("login")

    cy.visit("localhost:3000/user/users")
    cy.get("form legend").contains("register user:")
    cy.get("form button#post").contains("add user")
  })
})
describe("can takes api folder and create api and also linking straight forwardly to typescript file", () => {
  before(async () => {
    await fetch("/api/reset")
  })
  it("simple usecase when trying to do an unauthenticated action", () => {
    cy.visit("localhost:3000/user/users")
    cy.get("form #username").type("grand_art")
    cy.get("form #password").type("2222")
    cy.get("form button#post").click()
    cy.get("div#message").contains("not authorized")
  })
  it("gives feedback when login fails", () => {
    cy.visit("localhost:3000/user/login")
    cy.get("form #username").type("not a user")
    cy.get("form #password").type("not exist")
    cy.get("form button#post").click()
    cy.get("div#message").contains("username or password is wrong")
  })
  it("demonstrate a usecase when an authorized user trying to do something", () => {
    cy.visit("localhost:3000/user/login")
    cy.get("form #username").type("tom")
    cy.get("form #password").type("pass1234")
    cy.get("form button#post").click()
    cy.get("div#message").contains("logged in successfully")

    cy.visit("localhost:3000/user/users")
    cy.get("form #username").type("grand_art")
    cy.get("form #password").type("2222")
    cy.get("form button#post").click()
    cy.get("div#message").contains("you don't have permission to add user")
  })
  it("demonstrate an authorized user to do top level action", () => {
    cy.visit("localhost:3000/user/login")
    cy.get("form #username").type("ali")
    cy.get("form #password").type("1111")
    cy.get("form button#post").click()
    cy.get("div#message").contains("logged in successfully")

    cy.visit("localhost:3000/user/users")
    cy.get("form #username").type("ali")
    cy.get("form #password").type("2222")
    cy.get("form button#post").click()
    cy.get("div#message").contains("username already exist")

    cy.get("form #username").clear().type("grand_art")
    cy.get("form #password").clear().type("2222")
    cy.get("form button#post").click()
    cy.get("div#message").contains("successfully added")
  })
  it("can take parameters through GET method without any change", () => {
    cy.visit("localhost:3000/user/login")
    cy.get("form #username").type("not a user")
    cy.get("form #password").type("not exist")
    cy.get("form button#get").click()
    cy.get("div#message").contains("username or password is wrong")

    cy.get("form #username").clear().type("ali")
    cy.get("form #password").clear().type("1111")
    cy.get("form button#get").click()
    cy.get("div#message").contains("logged in successfully")
  })
  it("api files can exports object too which the leafs(end points) of it are functions", () => {
    cy.visit("localhost:3000/greet")
    cy.contains("greetings Mr. safari")
    cy.contains("greetings Mrs. rui")
  })
})

describe("can make it works with jsx ", () => {
  it("can have jsx which exports index function without any parameters so it will render it only once", () => {
    cy.visit("localhost:3000/user/main")
    cy.get("h1").contains("hello from JSX as static page")
    cy.get("body").should("have.css", "background-color", "rgb(76, 211, 252)")
  })
  it("can have dynamic jsx which exports an index function with the same parameters as api and will be rendered at each request in the server", () => {
    cy.visit("localhost:3000/user/info?fname=ali&lname=safari")
    cy.get("h1").contains("hello there...oh you are ali safari")
    cy.get("body").should("have.css", "background-color", "rgb(199, 255, 199)")
  })
})
const pubFiles = ["", "/index.html", "/a.js", "/a.css"]
describe("can watch files at runtime in public folder", () => {
  it("can add folder at runtime in public folder", () => {
    cy.request("http://localhost:3000/api/cmdPubFolder?action=delete")
    cy.wait(200)
    pubFiles.forEach(url => {
      cy.request({
        url: "http://localhost:3000/a/a" + url,
        failOnStatusCode: false,
      }).then(res => {
        expect(res.status).equal(404)
      })
    })
    cy.request("http://localhost:3000/api/cmdPubFolder?action=copy")
    cy.wait(200)
    pubFiles.forEach(url => {
      cy.request("http://localhost:3000/pub/a/a" + url)
    })
  })
  it("can add file at runtime in public folder", () => {
    cy.request("http://localhost:3000/api/manipulateRuntimeIndex?action=delete")
    cy.wait(100)
    cy.request({
      failOnStatusCode: false,
      url: "http://localhost:3000/runtime",
    }).then(res => {
      expect(res.status).equal(404)
      cy.request(
        "http://localhost:3000/api/manipulateRuntimeIndex?action=create"
      ).then(res => {
        if (res.status === 200) {
          cy.wait(200).then(() => {
            cy.request("http://localhost:3000/runtime")
          })
        }
      })
    })
    cy.request("http://localhost:3000/api/cmdPubFile?action=delete")
    cy.wait(200)
    cy.request({
      failOnStatusCode: false,
      url: "http://localhost:3000/pub/a",
    })
    cy.request("http://localhost:3000/api/cmdPubFile?action=copy")
    cy.wait(200)
    cy.request("http://localhost:3000/pub/a")
  })

  it("can detect folder deletion in public folder at runtime and all the urls of it will be gone", () => {
    cy.request("http://localhost:3000/api/cmdPubFolder?action=delete")
    cy.wait(200)
    pubFiles.forEach(url => {
      cy.request({
        url: "http://localhost:3000/a/a" + url,
        failOnStatusCode: false,
      }).then(res => {
        expect(res.status).equal(404)
      })
    })
  })
  it("can detect file deletion in public folder at runtime and its url will be gone", () => {
    cy.request("http://localhost:3000/api/cmdPubFile?action=delete")
    cy.wait(200)
    cy.request({
      failOnStatusCode: false,
      url: "http://localhost:3000/pub/a",
    })
  })
})
describe("can watch api ", () => {
  it("will evaluate new api at runtime and reload the page", () => {
    cy.request("http://localhost:3000/api/changeApiAtRuttime?msg=hello%20there")
    cy.wait(waitTime)
    cy.visit("http://localhost:3000/greet")
    cy.wait(waitTime)
    cy.contains("hello there")
    cy.request("http://localhost:3000/api/changeApiAtRuttime?msg=hi%20ali")
    cy.wait(waitTime)
    cy.contains("hi ali")
    cy.request("http://localhost:3000/api/changeApiAtRuttime?msg=hello%20there")
    cy.contains("hello there")
  })
  it("can add folder api at run time and everything will be set", () => {
    cy.request("http://localhost:3000/api/cmdApiFolder?action=delete")
    cy.wait(waitTime)
    cy.request({
      url: "http://localhost:3000/a/a/a/msg?msg=hello",
      failOnStatusCode: false,
    }).then(res => {
      expect(res.status).equal(404)
    })
    cy.request("http://localhost:3000/api/cmdApiFolder?action=copy")
    cy.wait(waitTime)
    cy.request("http://localhost:3000/a/a/a/msg?msg=hello").then(res => {
      cy.log(res.body)
      expect(res.body.msg).equal(`a/a/a.ts got: hello`)
    })
  })
  it("can add api file at ruttime", () => {
    cy.request("http://localhost:3000/api/cmdApiFile?action=delete")
    cy.wait(waitTime)
    cy.request({
      url: "http://localhost:3000/a/b/msg?msg=hello",
      failOnStatusCode: false,
    }).then(res => {
      expect(res.status).equal(404)
    })
    cy.request("http://localhost:3000/api/cmdApiFile?action=copy")
    cy.wait(waitTime)
    cy.request("http://localhost:3000/a/b/msg?msg=hello").then(res => {
      cy.log(res.body)
      expect(res.body.msg).equal(`a/b.ts got: hello`)
    })
  })
  it("will detect folder deletion in api folder and all the url corresponding to it will be removed", () => {
    cy.request("http://localhost:3000/api/cmdApiFile?action=delete")
    cy.wait(waitTime)
    cy.request({
      url: "http://localhost:3000/a/b/msg?msg=hello",
      failOnStatusCode: false,
    }).then(res => {
      expect(res.status).equal(404)
    })
  })
  it("will detect file deletion in api folder and all the url corresponding to it will be removed", () => {
    cy.request("http://localhost:3000/api/cmdApiFolder?action=delete")
    cy.wait(waitTime)
    cy.request({
      url: "http://localhost:3000/a/a/a/msg?msg=hello",
      failOnStatusCode: false,
    }).then(res => {
      expect(res.status).equal(404)
    })
  })
})
