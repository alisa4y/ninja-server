describe("empty spec", () => {
  it("passes", () => {
    cy.visit("localhost:3000")
    cy.visit("localhost:3000/home")
    cy.visit("localhost:3000/home.html")
    cy.visit("localhost:3000/home/index.html")
    cy.get("#app h1").contains("says: Hellooo visitor world is beautiful!")
    cy.get("#app p").contains("running with server with easy css change")
  })
})
