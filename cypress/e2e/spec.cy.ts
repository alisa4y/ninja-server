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
})

describe("parsing jsx ", () => {
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
describe("can manipulate files at runtime", () => {
  it("can add file at runtime ", () => {
    cy.request("http://localhost:3000/api/manipulateRuntimeIndex?action=delete")
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
  })
})
