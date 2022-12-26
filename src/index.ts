import {
  watch,
  readFileSync,
  writeFileSync,
  mkdirSync,
  constants,
  readdirSync,
  FSWatcher,
} from "fs"
import { access, readFile } from "fs/promises"
import { createServer, IncomingMessage, ServerResponse } from "http"
import { connection, server as webSocketServer } from "websocket"
import { shield, cell, err, ox } from "flowco"
import { join, extname, dirname, basename } from "path"
import { impundler } from "js-bundler"
import * as Url from "url"

// import { minify } from "html-minifier-terser"

let g_config: {
  defaultFile: string
  host: string
  port: number
  publicDir: string
  watch: boolean
  notFound: string
  reloadExtRgx?: RegExp
  skipExtensions?: string[]
  plugins: Record<
    string,
    (path: string) => {
      newExtensionName: string
      content: Buffer
      ignore: boolean
    }
  >
}
const configFileName = "server.config.js"
const projectConfigFilePath = join(process.cwd(), configFileName)
try {
  g_config = require(projectConfigFilePath)
} catch (e) {
  console.warn(e)
  const configFilePath = join(__dirname, "..", configFileName)
  const configFile = readFileSync(configFilePath, "utf8")
  writeFileSync(projectConfigFilePath, configFile)
  g_config = require(projectConfigFilePath)
}
g_config.defaultFile = joinUrl(g_config.defaultFile || "index.html")

const site = new Map()
const api = new Map()

let httpServer: ReturnType<typeof createServer>

const { host, port } = g_config
const uri = port === 80 ? `http://${host}` : `http://${host}:${port}`
const workingDir = join(process.cwd(), g_config.publicDir)

// -------------------------------  watch variables  -------------------------------
const connections: Set<connection> = new Set()
const setCounter = cell((counter, action) => {
  let v = counter
  switch (action) {
    case "inc":
      v++
      break
    case "dec":
      v !== 0 && v--
      break
  }
  v === 0 && connections.forEach(c => c.sendUTF("reload"))
  return v
}, 0)
export async function startServer() {
  await setup(workingDir)

  httpServer = createServer(handleRequest)
  httpServer.listen(port, host).on("listening", () => {
    console.log(`Server running at ${uri}/`)
  })
  if (g_config.watch) watchStructure()
  await initApi()
}
const nf = {
  header: { "Content-Type": "text/plain" },
  data: "Not Found",
  statusCode: 404,
}
const bodyMethod = ["POST", "PUT"]
const paramMethod = ["GET", "DELETE"]
function getBody(req: InstanceType<typeof IncomingMessage>) {
  return new Promise((res, rej) => {
    let body = ""
    req.on("data", (chunk: string) => {
      body += chunk
    })
    req.on("end", () => {
      try {
        res(JSON.parse(body))
      } catch (e) {
        res(body)
      }
    })
    req.on("error", rej)
  })
}
function stripUrl(url: string) {
  const index = url.indexOf("?")
  if (index > 0) return url.slice(0, index)
  return url
}
export type XParam = {
  req: IncomingMessage
  headers: Record<string, any>
  statusCode: number
}
async function handleRequest(
  req: InstanceType<typeof IncomingMessage>,
  res: ServerResponse
) {
  const { url, method } = req
  let result = site.get(url)
  if (result === undefined) {
    let data
    let paramObj
    const exParam: XParam = { req, headers: {}, statusCode: 200 }
    try {
      if (bodyMethod.includes(method)) {
        paramObj = await getBody(req)
      } else if (paramMethod.includes(method)) {
        paramObj = Url.parse(url, true).query
      }
      data = await api.get(stripUrl(url))?.(paramObj, exParam)
    } catch (e) {
      exParam.statusCode = 500
      console.log(e.message)
      data = "something went wrong"
    }
    if (data === undefined) {
      result = site.get(g_config.notFound) || nf
    } else {
      if (data === null) data = ""
      result = {
        headers: {
          "Content-Type":
            typeof data === "string" ? "text/plain" : "application/json",
          ...exParam.headers,
        },
        data: typeof data === "string" ? data : JSON.stringify(data),
        statusCode: exParam.statusCode,
      }
    }
  }
  const { headers, data, statusCode = 200 } = result
  res.writeHead(statusCode, headers)
  res.end(data)
}
async function setup(workingDir: string) {
  try {
    await access(workingDir, constants.F_OK)
  } catch (err) {
    mkdirSync(workingDir)
    const wdPath = join(workingDir, "home")
    mkdirSync(wdPath)
    const homePath = join(__dirname, "../public/home")
    const files = readdirSync(homePath)
    files.forEach(f => {
      const data = readFileSync(join(homePath, f))
      writeFileSync(join(wdPath, f), data)
    })
  }

  await setupSiteFiles(workingDir)
  site.set("/", site.get(g_config.defaultFile))
}
async function setupSiteFiles(dir: string, url = "/") {
  await Promise.allSettled(
    readdirSync(dir).map(async file => {
      const path = join(dir, file)
      const ext = extname(file)
      const fileUrl = joinUrl(url, file)
      if (ext === "") await setupSiteFiles(path, fileUrl)
      else if (!g_config.skipExtensions?.includes(ext)) {
        await setupSiteFile(path, ext, fileUrl)
      }
    })
  )
}
const jsWatchers: FSWatcher[] = []
async function setupSiteFile(path: string, ext: string, url: string) {
  const plugin = g_config.plugins?.[ext]
  let file
  try {
    if (plugin) {
      const {
        newExtensionName: newExt = ext,
        content: fileContent,
        ignore,
      } = await plugin(path)
      if (ignore) return
      file = fileContent
      url = url.slice(0, -ext.length) + newExt
      ext = newExt
    } else if (ext === ".js") {
      setSiteFile(url, Buffer.from(""))
      const urlObj = site.get(url)
      setCounter("inc")
      impundler(path, { watch: g_config.watch }, str => {
        urlObj.data = str
        setCounter("dec")
      }).then(ifile => {
        jsWatchers.push(ifile.watcher)
      })
      return
    } else file = await readFile(path)

    if (ext === ".html") setSiteFile(url, handleHtmlFile(file, url))
    else setSiteFile(url, file)
  } catch (e) {
    console.log(e)
  }
}
const utf8ContentType = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "text/plain",
  "text/css",
  "application/json",
  "application/javascript",
  "application/ecmascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/javascript",
  "text/ecmascript",
  "application/x-httpd-php",
  "application/x-httpd-php-source",
  "application/x-httpd-php3",
  "application/x-httpd-php4",
  "application/x-httpd-php5",
  "application/x-httpd-php-source",
  "application/x-httpd-php-script",
  "application/x-httpd-php-code",
  "application/x-httpd-php-code",
  "application/x-httpd-php-source",
  "application/x-httpd-php-src",
  "application/x-httpd-php-script",
  "application/x-httpd-php-code",
  "application/x-httpd-php-code",
  "application/x-httpd-php-source",
  "application/x-httpd-php-src",
  "application/x-httpd-php-script",
  "application/x-httpd-php-code",
  "application/x-httpd-php-code",
  "application/x-httpd-php-source",
  "application/x-httpd-php-src",
  "application/x-httpd-php-script",
  "application/x-httpd-php-code",
  "application/x-httpd-php-code",
  "application/x-httpd-php-source",
  "application/x-httpd-php-src",
  "application/x-httpd-php-script",
  "application/x-httpd-php-code",
  "application/x-httpd-php-code",
  "application/x-httpd-php-source",
  "application/x-httpd-php-src",
  "application/x-httpd-php-script",
  "application/x-httpd-php-code",
  "application/x-httpd-php-code",
  "application/x-httpd-php-source",
  "application/x-httpd-php-src",
  "application/x-httpd-php-script",
  "application/x-httpd-php-",
])
function setSiteFile(url: string, data: Buffer, headers = {}) {
  const contentType = getContentType(url)
  site.set(url, {
    header: {
      "Content-Type": contentType,
      // "Content-Length": data.length,
      ...headers,
    },
    data,
  })
  if (basename(url) === "index.html") {
    const dirUrl = joinUrl(url, "..")
    site.set(dirUrl, site.get(url))
    site.set(dirUrl + ".html", site.get(url))
    if (dirUrl === g_config.defaultFile) site.set("/", site.get(url))
  }
  if (url === g_config.defaultFile) site.set("/", site.get(url))
}
const cws = `const __socket = new WebSocket('ws://${host}:${port}');
__socket.addEventListener('open', function (event) {
    __socket.send('Hello Server!');
});
__socket.addEventListener('message', function (event) {
    if(event.data === 'reload') window.location.reload();
});`
function handleHtmlFile(data: Buffer, url: string) {
  let dataStr = validateLinks(data.toString(), url)
  if (g_config.watch)
    dataStr = dataStr.replace("</body>", "<script>" + cws + "</script>")
  return Buffer.from(dataStr)
}
function getContentType(path: string) {
  switch (extname(path)) {
    case ".html":
      return "text/html"
    case ".css":
      return "text/css"
    case ".js":
      return "application/javascript"
    case ".json":
      return "application/json"
    case ".png":
      return "image/png"
    case ".jpg":
      return "image/jpeg"
    case ".gif":
      return "image/gif"
    case ".svg":
      return "image/svg+xml"
    default:
      return "text/plain"
  }
}
let wsServer: webSocketServer, watcher: FSWatcher
function watchStructure() {
  wsServer = new webSocketServer({ httpServer })
  wsServer.on("request", request => {
    const con = request.accept()
    connections.add(con)
    con.on("close", () => {
      connections.delete(con)
    })
  })
  const isReloadExtRgx = g_config.reloadExtRgx
  watcher = watch(
    workingDir,
    { recursive: true },
    shield(async (eventType, filename) => {
      const ext = extname(filename)
      if (eventType === "change" && ext !== "") {
        const isLoad = isReloadExtRgx?.test(ext)
        isLoad && setCounter("inc")
        if (ext !== ".js") {
          const url = joinUrl(filename)
          await setupSiteFile(join(workingDir, filename), ext, url)
          isLoad && setCounter("dec")
        }
      }
    }, 300)
  )
}
function joinUrl(...args: string[]) {
  return (
    "/" +
    args
      .map(a =>
        a
          .replaceAll("\\", "/")
          .split("/")
          .filter(v => v !== "" && v !== ".")
      )
      .filter(ar => ar.length !== 0)
      .flat()
      .reduce((acc, v) => {
        v === ".." ? acc.pop() : acc.push(v)
        return acc
      }, [])
      .join("/")
  )
}
function validateLinks(data: string, baseUrl: string) {
  const url = baseUrl.split("/").slice(0, -1).join("/")
  return data.replaceAll(
    /(href|src)="\.([^"]+)"/g,
    (m, p1, p2) => `${p1}="${joinUrl(url, p2)}"`
  )
}
async function initApi() {
  const apiFolder = join(process.cwd(), "./api")
  try {
    await setApiFolder(apiFolder)
  } catch (e) {
    console.log("couldn't read api")
  }
}
async function setApiFolder(dir: string, pre = "/") {
  await Promise.allSettled(
    readdirSync(dir).map(async file => {
      const path = join(dir, file)
      const ext = extname(file)
      if (ext === "") await setApiFolder(path, pre + file + "/")
      else if (ext === ".js") addApi(path, pre + file.slice(0, -3) + "/")
      else err("unhandled extension for Api")
    })
  )
}
async function addApi(path: string, pre: string) {
  const oApi = require(path)
  for (const name in oApi) {
    const f = oApi[name]
    api.set(pre + name, f)
  }
}

startServer()

function terminate() {
  console.log("terminating...")
  watcher.close()
  wsServer.closeAllConnections()
  httpServer.close()
  jsWatchers.forEach(f => f.close())
}

process.on("SIGINT", () => process.exit())
process.on("SIGTERM", () => process.exit())
process.on("exit", terminate)
