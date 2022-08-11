import {
  watch,
  readFileSync,
  writeFileSync,
  mkdirSync,
  constants,
  readdirSync,
} from "fs"
import { readFile } from "fs/promises"
import { access } from "fs/promises"
import { createServer } from "http"
import { server as webSocketServer } from "websocket"
import { factory, shield, cell } from "js-tools"
import { join, extname, dirname, basename } from "path"
import { fileURLToPath } from "url"
// import { minify } from "html-minifier-terser"
import { impundler } from "js-bundler"

const __dirname = dirname(fileURLToPath(import.meta.url))
let g_config
const configFileName = "server.config.js"
const projectConfigFilePath = join(process.cwd(), configFileName)
try {
  g_config = (await import("file:///" + projectConfigFilePath)).default
} catch (e) {
  const configFilePath = join(__dirname, "..", configFileName)
  const configFile = readFileSync(configFilePath, "utf8")
  writeFileSync(projectConfigFilePath, configFile)
  g_config = (await import("file:///" + projectConfigFilePath)).default
}
g_config.defaultFile = joinUrl(g_config.defaultFile || "index.html")

const site = new Map()
const api = new Map()
let httpServer

const { host, port } = g_config
const uri = port === 80 ? `http://${host}` : `http://${host}:${port}`
const workingDir = join(process.cwd(), g_config.publicDir)

// -------------------------------  watch variables  -------------------------------
const connections = new Set()
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

async function startServer() {
  await setup(workingDir)

  httpServer = createServer(handleRequest)
  httpServer.listen(port, host).on("listening", () => {
    console.log(`Server running at ${uri}/`)
  })
  if (g_config.watch) watchStructure()
}

const nf = {
  header: { "Content-Type": "text/plain" },
  data: "Not Found",
  statusCode: 404,
}
function handleRequest(req, res) {
  const {
    header,
    data,
    statusCode = 200,
  } = site.get(req.url) || site.get(g_config.notFound) || nf
  res.writeHead(statusCode, header)
  res.end(data)
}
async function setup(workingDir) {
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
async function setupSiteFiles(dir, url = "/") {
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
async function setupSiteFile(path, ext, url) {
  const plugin = g_config.plugins?.[ext]
  let file
  try {
    if (plugin) {
      const { ext: newExt = ext, file: fileContent, skip } = await plugin(path)
      if (skip) return
      file = fileContent
      url = url.slice(0, -ext.length) + newExt
      ext = newExt
    } else if (ext === ".js") {
      setSiteFile(url, "")
      const urlObj = site.get(url)
      setCounter("inc")
      return impundler(path, { watch: g_config.watch }, str => {
        urlObj.data = str
        setCounter("dec")
      })
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
function setSiteFile(url, data, headers = {}) {
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
function handleHtmlFile(data, url) {
  data = validateLinks(data.toString(), url)
  if (g_config.watch)
    data = data.replace("</body>", "<script>" + cws + "</script>")
  return data
}
function getContentType(path) {
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

function watchStructure() {
  const wsServer = new webSocketServer({ httpServer })
  wsServer.on("request", request => {
    const con = request.accept()
    connections.add(con)
    con.on("close", () => {
      connections.delete(con)
    })
  })
  const isReloadExtRgx = g_config.reloadExtRgx
  const w = watch(
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
function joinUrl(...args) {
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

function validateLinks(data, baseUrl) {
  const url = baseUrl.split("/").slice(0, -1).join("/")
  return data.replaceAll(
    /(href|src)="\.([^"]+)"/g,
    (m, p1, p2) => `${p1}="${joinUrl(url, p2)}"`
  )
}
startServer()
