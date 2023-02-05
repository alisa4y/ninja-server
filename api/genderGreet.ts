type P = (arg: { name: string }) => string
export const greets: { mr: P; mrs: P } = {
  mr({ name }) {
    return `greetings Mr. ${name}`
  },
  mrs({ name }) {
    return `greetings Mrs. ${name}`
  },
}
