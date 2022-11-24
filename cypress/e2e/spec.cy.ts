describe("server structure", () => {
  it("provides default file field in configuration as main page when entering url of website", () => {
    cy.visit("localhost:3000")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running with server with easy css change")
  })
  it("creates multiple address of the same html file in a folder using index.html as its refrence", () => {
    cy.visit("localhost:3000")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running with server with easy css change")

    cy.visit("localhost:3000/home")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running with server with easy css change")

    cy.visit("localhost:3000/home.html")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running with server with easy css change")

    cy.visit("localhost:3000/home/index.html")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running with server with easy css change")
  })
  it("creates urls of public directory till it reaches the index.html", () => {
    cy.visit("localhost:3000/home")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running with server with easy css change")

    cy.visit("localhost:3000/user/login")
    cy.get("form legend").contains("login:")
    cy.get("form button#post").contains("login")

    cy.visit("localhost:3000/user/users")
    cy.get("form legend").contains("register user:")
    cy.get("form button#post").contains("add user")
  })
})
describe("can takes api folder and create api simply", () => {
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
