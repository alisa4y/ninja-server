import {
  watch,
  readFileSync,
  writeFileSync,
  mkdirSync,
  constants,
  readdirSync,
  FSWatcher,
} from "fs"
import { access, readFile, mkdir, writeFile } from "fs/promises"
import { createServer, IncomingMessage, ServerResponse } from "http"
import { connection, server as webSocketServer } from "websocket"
import { shield, cell, debounce, timeout } from "flowco"
import { join, extname, basename } from "path"
import { closeAllBundles, impundler } from "js_bundler"
import * as Url from "url"
import ts from "typescript"
import { transpileJSX } from "jsx_transpiler"

// import { minify } from "html-minifier-terser"

let g_config: {
  defaultFile: string
  host: string
  port: number
  publicDir: string
  watch: boolean
  apiExtension: string
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
const apiExt = g_config.apiExtension
g_config.defaultFile = joinUrl(g_config.defaultFile || "index.html")

type WebPageI = { headers: any; data: Buffer }
const site: Map<string, WebPageI> = new Map()
const api = new Map()

let httpServer: ReturnType<typeof createServer>

const { host, port } = g_config
const uri = port === 80 ? `http://${host}` : `http://${host}:${port}`
const workingDir = join(process.cwd(), g_config.publicDir)

// -------------------------------  watch variables  -------------------------------
const connections: Set<connection> = new Set()

const setCounter = cell((counter: number, action: "inc" | "dec") => {
  let v = counter
  switch (action) {
    case "inc":
      v++
      break
    case "dec":
      v !== 0 && v--
      v === 0 && connections.forEach(c => c.sendUTF("reload"))
      break
  }
  return v
}, 0)
export async function startServer() {
  await setup(workingDir)

  httpServer = createServer(handleRequest)
  httpServer.listen(port, host).on("listening", () => {
    console.clear()
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
  let result: any = site.get(url)
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
function setupSiteFiles(dir: string, url = "/"): Promise<any> {
  return Promise.allSettled(
    readdirSync(dir).map(file => {
      const path = join(dir, file)
      const ext = extname(file)
      const fileUrl = joinUrl(url, file)
      if (ext === "") return setupSiteFiles(path, fileUrl)
      else if (!g_config.skipExtensions?.includes(ext)) {
        return setupSiteFile(path, ext, fileUrl)
      }
    })
  )
}
type Fn = (...args: any[]) => string
const jsWatchers: FSWatcher[] = []
const impundledFiles: Set<string> = new Set()
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
    } else if (ext === ".js" || ext === ".ts") {
      setSiteFile(url, Buffer.from(""))
      const urlObj = site.get(url)
      impundledFiles.add(path)
      setCounter("inc")
      return await impundler(path, { watch: g_config.watch }, async str => {
        urlObj.data = Buffer.from(str)
        setCounter("dec")
      })
    } else if (ext === ".jsx" || ext === ".tsx") {
      return handleJSX(path, url)
    } else file = await readFile(path)
    if (ext === ".html")
      setSiteFile(url, Buffer.from(handleHtmlFile(file, url)))
    else setSiteFile(url, file)
  } catch (e) {
    console.log(e)
  }
}
const jsxPlugin = {
  ".jsx": (code: string) => transpileJSX(code),
  ".tsx": (code: string) =>
    transpileJSX(
      ts.transpile(code, {
        module: ts.ModuleKind.Node16,
        removeComments: true,
        jsx: ts.JsxEmit.Preserve,
      })
    ),
}
function handleJSX(filePath: string, url: string) {
  url = url.slice(0, -4) + ".html"
  impundledFiles.add(filePath)
  setCounter("inc")
  impundler(
    filePath,
    { watch: g_config.watch, plugins: jsxPlugin },
    async (result, bundle) => {
      const { index }: { index: Fn } = eval(result)
      if (index === undefined) {
        return bundle.unhandle()
      }
      if (index.length === 0) {
        let file = Buffer.from("<!DOCTYPE html>" + index())
        setSiteFile(url, Buffer.from(handleHtmlFile(file, url)))
      } else {
        const toHtml = (params: any, x: any) => {
          x.headers = {
            "Content-Type": "text/html",
          }
          return handleHtmlFile(
            Buffer.from("<!DOCTYPE html>" + index(params, x)),
            url
          )
        }
        api.set(url, toHtml)
        handleIndexHtml(url, toHtml, api)
      }
      setCounter("dec")
    }
  )
}
function setSiteFile(url: string, data: Buffer, headers = {}) {
  const contentType = getContentType(url)
  site.set(url, {
    headers: {
      "Content-Type": contentType,
      // "Content-Length": data.length,
      ...headers,
    },
    data,
  })
  handleIndexHtml(url, site.get(url), site)
}
function handleIndexHtml(url: string, value: any, source: Map<string, any>) {
  if (basename(url) === "index.html") {
    const dirUrl = joinUrl(url, "..")
    source.set(dirUrl, value)
    source.set(dirUrl + ".html", value)
    if (dirUrl === g_config.defaultFile) source.set("/", value)
  }
  if (url === g_config.defaultFile) source.set("/", value)
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
  return dataStr
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
let wsServer: webSocketServer
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
  const handledFiles: Set<string> = new Set()
  const watcher = watch(
    workingDir,
    { recursive: true },
    async (eventType, filename) => {
      if (handledFiles.has(filename)) return
      handledFiles.add(filename)
      setTimeout(() => {
        handledFiles.clear()
      }, 300)
      const ext = extname(filename)
      if (eventType === "change" && ext !== "") {
        const isLoad = isReloadExtRgx?.test(ext)
        const filePath = join(workingDir, filename)
        if (!impundledFiles.has(filePath)) {
          isLoad && setCounter("inc")
          const url = joinUrl(filename)
          await setupSiteFile(filePath, ext, url)
          isLoad && setCounter("dec")
        }
      }
    }
  )
  jsWatchers.push(watcher)
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
const apiFolderPath = join(process.cwd(), "./api")
async function initApi() {
  try {
    await access(apiFolderPath)
  } catch (e) {
    return console.log("there is no api folder")
  }
  try {
    await setApiFolder(apiFolderPath)
  } catch (e) {
    if (g_config.watch) {
      console.log(e)
    } else throw e
  }
}
const clientApiFolderPath = join(process.cwd(), "./clientApi")
async function setApiFolder(dir: string, pre = "/") {
  try {
    await access(clientApiFolderPath)
  } catch (e) {
    await mkdir(clientApiFolderPath)
  }
  await Promise.allSettled(
    readdirSync(dir).map(async file => {
      const path = join(dir, file)
      const ext = extname(file)
      if (ext === apiExt) {
        return setApi(path, pre + file.slice(0, -3) + "/")
      } else if (ext === "") return setApiFolder(path, pre + file + "/")
    })
  )
}
function setApi(path: string, pre: string) {
  impundledFiles.add(path)
  return impundler(path, { watch: g_config.watch }, async code => {
    setCounter("inc")
    const oApi = eval(code)
    for (const name in oApi) api.set(pre + name, oApi[name])
    await genFile(path, oApi)
    setCounter("dec")
  })
}
async function genFile(filePath: string, api: Record<string, any>) {
  let ret
  switch (extname(filePath)) {
    case ".js":
      ret = await generateClientApiFileJS(filePath, api)
      break
    case ".ts":
      ret = await generateClientApiFileTS(filePath, api)
      break
  }
  await writeFile(
    join(
      clientApiFolderPath,
      filePath.slice(apiFolderPath.length, -3) + apiExt
    ),
    ret
  )
}
async function generateClientApiFileJS(
  filePath: string,
  api: Record<string, any>
) {
  return `module.exports = {
    ${Object.keys(api)
      .map(
        name => `${name}: (data, options={}) => {
      return fetch("${filePath.slice(0, -3)}", {
        method: "POST",
        body: JSON.stringify(data),
        ...options
      })
    }`
      )
      .join()}
  }`
}

async function generateClientApiFileTS(
  filePath: string,
  api: Record<string, any>
) {
  const apiPath = filePath.slice(apiFolderPath.length, -3).replaceAll("\\", "/")

  return `import * as __oApi from "../api${apiPath}"\n
    ${Object.keys(api)
      .filter(name => name !== "__esModule")
      .map(
        name => `export function ${name} (data:Parameters<typeof __oApi.${name}>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.${name}>>, Record<any, any>>
  type RetType =  ObjRetType extends never 
    ? Omit<Response, "json"> & {
      json: () => Promise<never>
    }
    : Omit<Response, "json"> & {
        json: () => Promise<ObjRetType>
      }
  return fetch("${apiPath}/${name}", {
    method: "POST",
    body: JSON.stringify(data),
    ...options
  }) as Promise<RetType>
}`
      )
      .join("\n")}
  `
}

startServer()

function terminate() {
  console.log("terminating...")
  jsWatchers.forEach(w => w.close())
  wsServer.closeAllConnections()
  httpServer.close()
  closeAllBundles()
}

process.on("SIGINT", () => process.exit())
process.on("SIGTERM", () => process.exit())
process.on("exit", terminate)
