import { add } from "../../../clientApi/api"
window.addEventListener("load", () => {
  const usernameInp = document.getElementById("username") as HTMLInputElement
  const passwordInp = document.getElementById("password") as HTMLInputElement
  const messageElm = document.getElementById("message")
  const buttonElm = document.querySelector("form button#post")
  buttonElm?.addEventListener("click", e => {
    e.preventDefault()
    add(
      {
        username: usernameInp?.value,
        password: passwordInp?.value,
        auth: "standard",
      },
      {
        headers: {
          Authorization: `Bearer ${
            document.cookie
              .split(";")
              .map(c => c.trim())
              .find(c => c.startsWith("token="))
              ?.split("=")[1]
          }`,
        },
      }
    )
      .then(({ message }) => {
        if (messageElm) messageElm.textContent = message
        else console.warn("couldn't find message element")
      })
      .catch(({ message }) => {
        if (messageElm) messageElm.textContent = message
      })
  })
})
