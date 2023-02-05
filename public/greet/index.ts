import { greets } from "../../api/genderGreet"
window.addEventListener("load", () => {
  const mr = document.getElementById("Mr") as HTMLElement
  const mrs = document.getElementById("Mrs") as HTMLElement
  mr.textContent = greets.mr({ name: "safari" })
  mrs.textContent = greets.mrs({ name: "rui" })
})
