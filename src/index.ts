import { watch, readFileSync, writeFileSync, FSWatcher, existsSync } from "fs"
import { readFile, mkdir, writeFile, stat, readdir } from "fs/promises"
import { createServer, IncomingMessage, ServerResponse } from "http"
import { connection, server as webSocketServer } from "websocket"
import { cell, debounce, ox } from "vaco"
import { join, extname, basename, dirname } from "path"
import { closeAllBundles, impundler } from "bundlex"
import { URL } from "url"
import querystring from "querystring"
import ts from "typescript"
import { transpileJSX } from "jsxpiler"
import { $C, aim, curry } from "bafu"
import { addHook } from "pirates"
// import { minify } from "html-minifier-terser"

const tsJsxOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.Node16,
  removeComments: true,
  jsx: ts.JsxEmit.Preserve,
  esModuleInterop: true,
}
const transpileTs = aim(ts.transpile, tsJsxOptions)
const transpileTsx = $C(transpileJSX, transpileTs)
addHook(code => transpileTs(code), { ext: ".ts" })
addHook(code => transpileJSX(code), { ext: ".jsx" })
addHook(code => transpileTsx(code), { ext: ".tsx" })
addHook(code => `module.exports= \`${code}\``, { ext: ".svg" })

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
if (!existsSync(projectConfigFilePath)) {
  const configFilePath = join(__dirname, "..", configFileName)
  const configFile = readFileSync(configFilePath, "utf8")
  writeFileSync(projectConfigFilePath, configFile)
}
g_config = require(projectConfigFilePath)
g_config.defaultFile = joinUrl(g_config.defaultFile || "index.html")

type WebPageI = { headers: any; data: Buffer; statusCode?: number }
const site: Map<string, WebPageI> = new Map()
const api: Map<string, any> = new Map()

let httpServer: ReturnType<typeof createServer>

const { host, port } = g_config
const uri = port === 80 ? `http://${host}` : `http://${host}:${port}`
const publicDir = join(process.cwd(), g_config.publicDir)

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
  await setup(publicDir)

  httpServer = createServer(handleRequest)
  httpServer.listen(port, host).on("listening", () => {
    // console.clear()
    console.log(`Server running at ${uri}/`)
  })
  if (g_config.watch) watchStructure()
  await initApi()
}
const cws = `const __socket = new WebSocket('ws://${host}:${port}');
__socket.addEventListener('open', function (event) {
    __socket.send('Hello Server!');
});
__socket.addEventListener('message', function (event) {
    if(event.data === 'reload') window.location.reload();
});`
const nf = {
  headers: { "Content-Type": "text/html" },
  data: Buffer.from(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <script>${cws}</script>
  </body>
</html>`),
  statusCode: 404,
}
const bodyMethod = ["POST", "PUT"]
const paramMethod = ["GET", "DELETE"]
function getBody(req: InstanceType<typeof IncomingMessage>): Promise<string> {
  return new Promise((res, rej) => {
    let body = ""
    req.on("data", (chunk: string) => {
      body += chunk
    })
    req.on("end", () => {
      res(body)
    })
    req.on("error", rej)
  })
}
function stripUrl(url: string) {
  const index = url.indexOf("?")
  if (index > 0) return url.slice(0, index)
  return url
}
export class XCon {
  constructor(
    public request: IncomingMessage,
    public headers: Record<string, any>,
    public statusCode: number
  ) {}
  error(code: number, message: string) {
    this.statusCode = code
    return message
  }
}
async function getParams(req: InstanceType<typeof IncomingMessage>) {
  const { url, method } = req
  if (bodyMethod.includes(method)) {
    return JSON.parse(await getBody(req))
  } else if (paramMethod.includes(method)) {
    const u = new URL(url, `http://${req.headers.host}`)
    return querystring.parse(u.searchParams.toString())
  }
}
function respond(
  res: ServerResponse,
  result: { headers: Record<string, any>; data: Buffer; statusCode?: number }
) {
  const { headers, data, statusCode = 200 } = result
  res.writeHead(statusCode, headers)
  res.end(data)
}
async function handleRequest(
  req: InstanceType<typeof IncomingMessage>,
  res: ServerResponse
) {
  const { url, method } = req
  const end = curry(respond, res)
  if (method === "GET" && site.has(url)) {
    end(site.get(url))
  } else if (api.has(stripUrl(url))) {
    let paramObj
    try {
      paramObj = await getParams(req)
    } catch (e) {
      console.warn("failed to fetch params")
      console.warn(e)
      res.writeHead(400, { "Content-Type": "text/plain" })
      return res.end(e.message)
    }
    let ret: string
    const xc = new XCon(req, {}, 200)
    try {
      ret = await api.get(stripUrl(url))(paramObj, xc)
    } catch (e) {
      console.warn(e)
      xc.statusCode = 500
      ret = "something went wrong"
    }
    ret ??= ""
    const data = Buffer.from(
      typeof ret === "string" ? ret : JSON.stringify(ret)
    )
    end({
      headers: {
        "Content-Type":
          typeof ret === "string" ? "text/plain" : "application/json",
        "Content-Length": data.length,
        ...xc.headers,
      },
      data,
      statusCode: xc.statusCode,
    })
  } else {
    end(site.get(g_config.notFound) || nf)
  }
}
async function setup(publicDir: string) {
  if (!existsSync(publicDir)) {
    await mkdir(join(publicDir, "home"), { recursive: true })
  }
  const tsConfigPath = join(publicDir, "tsconfig.json")
  if (!existsSync(tsConfigPath)) {
    await writeFile(
      tsConfigPath,
      await readFile(join(__dirname, "./tsconfig4public.json"))
    )
  }
  await setupSiteFiles(publicDir)
  site.set("/", site.get(g_config.defaultFile))
}
async function setupSiteFiles(dir: string, url = "/"): Promise<any> {
  const files = await readdir(dir)
  return Promise.allSettled(
    files.map(async file => {
      const filePath = join(dir, file)
      const ext = extname(file)
      const urlPath = joinUrl(url, file)

      if ((await stat(filePath)).isDirectory())
        return setupSiteFiles(filePath, urlPath)
      else if (!g_config.skipExtensions?.includes(ext)) {
        return setupSiteFile(filePath, ext, urlPath)
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
      return impundler(
        path,
        {
          watch: g_config.watch,
          onFileDelete: () => impundledFiles.delete(path),
        },
        async str => {
          const data = Buffer.from(str)
          urlObj.data = data
          urlObj.headers["Content-Length"] = data.length
          setCounter("dec")
        }
      ).catch(handleImpundlerError)
    } else if (ext === ".jsx" || ext === ".tsx") {
      return handleJSX(path, url)
    } else file = await readFile(path)
    if (ext === ".html")
      setSiteFile(url, Buffer.from(handleHtmlFile(file, url)))
    else setSiteFile(url, file)
  } catch (e) {
    handleError(e, "failed at evaluating pbulic file: " + path)
  }
}
function handleImpundlerError(e: Error) {
  setCounter("dec")
  console.warn("warning: " + e.message)
}
const jsxPlugin = {
  ".jsx": (code: string) => transpileJSX(code),
  ".tsx": (code: string) => transpileTs(code),
  ".svg": (code: string) => `export default \`${code}\``,
}
const onFileInvalidated = (filename: string) => {
  delete require.cache[require.resolve(filename)]
}
const docType = "<!DOCTYPE html>"
const generatedApi: Set<string> = new Set()
function handleJSX(filePath: string, url: string) {
  const htmlUrl = url.slice(0, -4) + ".html"
  impundledFiles.add(filePath)
  setCounter("inc")
  impundler(
    filePath,
    {
      watch: g_config.watch,
      plugins: jsxPlugin,
      onFileInvalidated,
      onFileDelete: () => impundledFiles.delete(filePath),
      bundleNodeModules: false,
    },
    async (result, bundle) => {
      const { index }: { index: Fn } = require(filePath)
      if (index === undefined) {
        return bundle.unhandle()
      }
      if (index.length === 0) {
        let file = Buffer.from(docType + (await index()))
        setSiteFile(htmlUrl, Buffer.from(handleHtmlFile(file, htmlUrl)))
      } else {
        const toHtml = async (params: any, x: any) => {
          x.headers = {
            "Content-Type": "text/html",
          }
          return handleHtmlFile(
            Buffer.from(docType + (await index(params, x))),
            htmlUrl
          )
        }
        generatedApi.add(htmlUrl)
        api.set(htmlUrl, toHtml)
        handleIndexHtml(htmlUrl, toHtml, api)
      }
      setCounter("dec")
    }
  ).catch(handleImpundlerError)
}

function setSiteFile(url: string, data: Buffer, headers = {}) {
  const contentType = getContentType(url)
  site.set(url, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": data.length,
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
  // it's watching the public directory for change then signal websocket to reload
  wsServer = new webSocketServer({ httpServer })
  wsServer.on("request", request => {
    const con = request.accept()
    connections.add(con)
    con.on("close", () => {
      connections.delete(con)
    })
  })
  const watcher = watchDir(
    publicDir,
    async (urlPath, ext, filePath) => {
      const isLoad = g_config.reloadExtRgx?.test(ext)
      isLoad && setCounter("inc")
      await setupSiteFile(filePath, ext, urlPath)
      isLoad && setCounter("dec")
    },
    async (urlPath, ext) => {
      if (ext === "") removeUrls(urlPath + "/")
      else removeUrl(urlPath)
      setCounter("dec")
    },
    impundledFiles
  )
  jsWatchers.push(watcher)
}
type HandleFn = (urlPath: string, ext: string, filePath: string) => void
function watchDir(
  dir: string,
  onChange: HandleFn,
  onDelete: HandleFn,
  impundledFiles: Set<string>
) {
  const handledFiles: Map<string, (fn: HandleFn) => void> = new Map()
  const gh = aim(getHandler, onChange, onDelete)
  return watch(dir, { recursive: true }, (eventType, filename) => {
    const ext = extname(filename)
    if (handledFiles.has(filename))
      return handledFiles.get(filename)(gh(eventType, ext))

    const filePath = join(dir, filename)
    const urlPath = joinUrl(filename)

    if (impundledFiles.has(filePath) || (eventType === "change" && ext === ""))
      return

    const d = debounce((fn: HandleFn) => fn(urlPath, ext, filePath), 100)
    d(eventType === "change" ? onChange : onDelete)
    handledFiles.set(filename, d)
  })
}
function getHandler(
  eventType: string,
  ext: string,
  onChange: HandleFn,
  onDelete: HandleFn
) {
  return eventType === "rename" ? onDelete : ext === "" ? ox : onChange
}
const indexExts = /\.[jt]sx$/
async function removeUrl(url: string) {
  if (site.has(url)) removeSiteUrl(url, site)
  else if (indexExts.test(url)) {
    const xUrl = url.slice(0, -4) + ".html"
    if (site.has(url)) removeSiteUrl(xUrl, site)
    else if (api.has(xUrl)) removeSiteUrl(xUrl, api)
  }
}
function removeSiteUrl(url: string, source: Map<string, any>) {
  source.set(url, site.get(g_config.notFound) || nf)
  handleIndexHtml(url, site.get(g_config.notFound) || nf, source)
}
function removeUrls(domainUrl: string) {
  site.forEach((v, url) => url.startsWith(domainUrl) && site.delete(url))
  generatedApi.forEach(url => {
    if (url.startsWith(domainUrl)) {
      removeSiteUrl(url, api)
      generatedApi.delete(url)
    }
  })
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
const apiImpundleredFiles: Set<string> = new Set()
const clientApiFolderPath = join(process.cwd(), "./clientApi")
async function initApi() {
  if (!existsSync(apiFolderPath)) {
    return console.log("there is no api folder")
  }
  if (!existsSync(clientApiFolderPath)) {
    await mkdir(clientApiFolderPath)
  }
  await setApiFolder(apiFolderPath)
  watchDir(
    apiFolderPath,
    async (urlPath, ext, filePath) => {
      if (ext === g_config.apiExtension) {
        setCounter("inc")
        await setApi(filePath, urlPath.slice(0, -3) + "/")
        setCounter("dec")
      }
    },
    async (urlPath, ext) => {
      const domainUrl = (ext === "" ? urlPath : urlPath.slice(0, -3)) + "/"
      api.forEach((v, url) => url.startsWith(domainUrl) && api.delete(url))
    },
    apiImpundleredFiles
  )
}
async function setApiFolder(dir: string, pre = "/") {
  await readdir(dir).then(files =>
    Promise.all(
      files.map(async file => {
        const path = join(dir, file)
        const ext = extname(file)
        if (ext === g_config.apiExtension) {
          return setApi(path, pre + file.slice(0, -3) + "/")
        } else if ((await stat(path)).isDirectory())
          return setApiFolder(path, pre + file + "/")
      })
    )
  )
}
function setApi(path: string, pre: string) {
  apiImpundleredFiles.add(path)
  return impundler(
    path,
    {
      watch: g_config.watch,
      bundleNodeModules: false,
      onFileInvalidated,
      onFileDelete: () => apiImpundleredFiles.delete(path),
    },
    () => {
      setCounter("inc")
      try {
        const oApi = require(path)
        setApiExports(oApi, pre)
        genFile(path, oApi).catch(e =>
          handleError(e, "couldn't generate clientApi for api at path: " + path)
        )
      } catch (e) {
        handleError(e, "failed to evaluate api at: " + path)
      }
      setCounter("dec")
    }
  ).catch(handleImpundlerError)
}
function handleError(e: Error, msg?: string) {
  if (msg) console.warn(msg)
  if (g_config.watch) {
    console.warn(e)
  } else throw e
}
function setApiExports(oApi: Record<string, any>, pre: string) {
  for (const name in oApi) {
    const v = oApi[name]
    switch (typeof v) {
      case "object":
        setApiExports(v, `${pre}/${name}/`)
        break
      case "function":
        const apiUrl = pre + name
        if (site.has(apiUrl))
          console.warn(`warning: url: "${apiUrl}" already exist in site url`)

        api.set(apiUrl, oApi[name])
        break
    }
  }
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
  const cPath = join(
    clientApiFolderPath,
    filePath.slice(apiFolderPath.length, -3) + g_config.apiExtension
  )
  await mkdir(dirname(cPath), { recursive: true })
  await writeFile(cPath, ret)
}
async function generateClientApiFileJS(
  filePath: string,
  api: Record<string, any>
) {
  const apiPath = filePath.slice(apiFolderPath.length, -3).replaceAll("\\", "/")
  return `module.exports = ${buildClientApiFileJS(apiPath, api)}`
}
function buildClientApiFileJS(
  apiPath: string,
  api: Record<string, any>
): string {
  const str = Object.keys(api)
    .map(name => {
      const v = api[name]
      switch (typeof v) {
        case "object":
          return name + ": " + buildClientApiFileJS(`${apiPath}/${name}`, v)
        case "function":
          const ln0 = v.length === 0
          return `${name}: (${ln0 ? "" : "data, "}options={}) => {
              return fetch("${apiPath}/${name}"${
            ln0
              ? ", options"
              : `, {method: "POST",body: JSON.stringify(data),...options}`
          }).then(async res => {
                if (res.ok) return await res.json()
                else throw new Error(await res.text())
              })
            }`
      }
    })
    .join()
  return `{${str}}`
}
async function generateClientApiFileTS(
  filePath: string,
  api: Record<string, any>
) {
  const apiPath = filePath.slice(apiFolderPath.length, -3).replaceAll("\\", "/")
  return `import * as __oApi from "../api${apiPath}"\n
    ${Object.keys(api)
      .filter(name => name !== "__esModule")
      .map(name => {
        const v = api[name]
        let ret: string
        switch (typeof v) {
          case "object":
            ret = clientApiFileTsObject(apiPath, [name], v)
            break
          case "function":
            ret = clientApiTsFunction(apiPath, [name], v.length === 0)
            break
        }
        return `export const ${name} = ${ret}`
      })
      .join("\n")}
  `
}
function clientApiFileTsObject(
  apiPath: string,
  keys: string[],
  api: Record<string, any>
): string {
  const result = Object.keys(api)
    .map(name => {
      const v = api[name]
      let ret = ""
      switch (typeof v) {
        case "object":
          ret = clientApiFileTsObject(apiPath, [...keys, name], v)
        case "function":
          ret = clientApiTsFunction(apiPath, [...keys, name], v.length === 0)
      }
      return name + ": " + ret
    })
    .join()
  return `{${result}}`
}
function clientApiTsFunction(apiPath: string, keys: string[], ln0: boolean) {
  const objPath = keys.map(k => `["${k}"]`).join("")
  return `function (${
    ln0 ? "" : `data:Parameters<typeof __oApi${objPath}>[0], `
  }options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi${objPath}>>, Record<any, any>>
  return fetch("${apiPath}/${keys.join("/")}"
    ${
      ln0
        ? ", options"
        : `, {method: "POST",body: JSON.stringify(data),...options}`
    }
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}`
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

const skipErrosCode = ["EPERM"] // since window will log this error when watched file is deleted for clearity it won't show it
process.on("uncaughtException", e => {
  if (skipErrosCode.includes((e as any).code)) return
  console.warn("uncaughtException: ", e)
})
process.on("unhandledRejection", e => {
  console.warn("unhandledRejection: ", e)
})
