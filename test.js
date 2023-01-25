const querystring = require("querystring")
const { URL } = require("url")
const str = `
(function(__exports={}){
  __exports.f = function  ({a}){
    console.log(a);
  }
  return __exports;
})()
`
try {
  setTimeout(() => {
    const { f } = eval(str)
    console.log(f())
  }, 300)
} catch (e) {
  // console.log(e)
  console.log("got error")
}

process.on("SIGINT", () => process.exit())
process.on("SIGTERM", () => process.exit())
process.on("exit", () => console.log("exitting............."))
// process.on("uncaughtException", e => console.log("uncaupht"))
// process.on("uncaughtExceptionMonitor", e => console.log("uncaupht moni"))
// process.on("unhandledRejection", e => console.log("unhandled rejection"))
