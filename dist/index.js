"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const http_1 = require("http");
const websocket_1 = require("websocket");
const vaco_1 = require("vaco");
const path_1 = require("path");
const bundlex_1 = require("bundlex");
const url_1 = require("url");
const querystring_1 = __importDefault(require("querystring"));
const typescript_1 = __importDefault(require("typescript"));
const jsxpiler_1 = require("jsxpiler");
const bafu_1 = require("bafu");
// import { minify } from "html-minifier-terser"
let g_config;
const configFileName = "server.config.js";
const projectConfigFilePath = (0, path_1.join)(process.cwd(), configFileName);
try {
    g_config = require(projectConfigFilePath);
}
catch (e) {
    if (e.code === "ENOENT") {
        const configFilePath = (0, path_1.join)(__dirname, "..", configFileName);
        const configFile = (0, fs_1.readFileSync)(configFilePath, "utf8");
        (0, fs_1.writeFileSync)(projectConfigFilePath, configFile);
        g_config = require(projectConfigFilePath);
    }
    else
        throw e;
}
const apiExt = g_config.apiExtension;
g_config.defaultFile = joinUrl(g_config.defaultFile || "index.html");
const site = new Map();
const api = new Map();
let httpServer;
const { host, port } = g_config;
const uri = port === 80 ? `http://${host}` : `http://${host}:${port}`;
const publicDir = (0, path_1.join)(process.cwd(), g_config.publicDir);
// -------------------------------  watch variables  -------------------------------
const connections = new Set();
const setCounter = (0, vaco_1.cell)((counter, action) => {
    let v = counter;
    switch (action) {
        case "inc":
            v++;
            break;
        case "dec":
            v !== 0 && v--;
            v === 0 && connections.forEach(c => c.sendUTF("reload"));
            break;
    }
    return v;
}, 0);
async function startServer() {
    await setup(publicDir);
    httpServer = (0, http_1.createServer)(handleRequest);
    httpServer.listen(port, host).on("listening", () => {
        // console.clear()
        console.log(`Server running at ${uri}/`);
    });
    if (g_config.watch)
        watchStructure();
    await initApi();
}
exports.startServer = startServer;
const cws = `const __socket = new WebSocket('ws://${host}:${port}');
__socket.addEventListener('open', function (event) {
    __socket.send('Hello Server!');
});
__socket.addEventListener('message', function (event) {
    if(event.data === 'reload') window.location.reload();
});`;
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
};
const bodyMethod = ["POST", "PUT"];
const paramMethod = ["GET", "DELETE"];
function getBody(req) {
    return new Promise((res, rej) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
        });
        req.on("end", () => {
            res(body);
        });
        req.on("error", rej);
    });
}
function stripUrl(url) {
    const index = url.indexOf("?");
    if (index > 0)
        return url.slice(0, index);
    return url;
}
async function getParams(req) {
    const { url, method } = req;
    if (bodyMethod.includes(method)) {
        return JSON.parse(await getBody(req));
    }
    else if (paramMethod.includes(method)) {
        const u = new url_1.URL(url, `http://${req.headers.host}`);
        return querystring_1.default.parse(u.searchParams.toString());
    }
}
function respond(res, result) {
    const { headers, data, statusCode = 200 } = result;
    res.writeHead(statusCode, headers);
    res.end(data);
}
async function handleRequest(req, res) {
    const { url } = req;
    const end = (0, bafu_1.curry)(respond, res);
    if (site.has(url)) {
        end(site.get(url));
    }
    else if (api.has(stripUrl(url))) {
        let paramObj;
        try {
            paramObj = await getParams(req);
        }
        catch (e) {
            console.warn("failed to fetch params");
            console.warn(e);
            res.writeHead(400, { "Content-Type": "text/plain" });
            return res.end(e.message);
        }
        let data;
        const exParam = { req, headers: {}, statusCode: 200 };
        try {
            data = await api.get(stripUrl(url))(paramObj, exParam);
        }
        catch (e) {
            console.warn(e);
            exParam.statusCode = 500;
            data = "something went wrong";
        }
        if (data === null)
            data = "";
        end({
            headers: {
                "Content-Type": typeof data === "string" ? "text/plain" : "application/json",
                ...exParam.headers,
            },
            data: typeof data === "string" ? data : JSON.stringify(data),
            statusCode: exParam.statusCode,
        });
    }
    else {
        end(site.get(g_config.notFound) || nf);
    }
}
async function setup(publicDir) {
    try {
        await (0, promises_1.access)(publicDir, fs_1.constants.F_OK);
    }
    catch (err) {
        (0, fs_1.mkdirSync)(publicDir);
        const wdPath = (0, path_1.join)(publicDir, "home");
        (0, fs_1.mkdirSync)(wdPath);
        // const homePath = join(__dirname, "../public/home")
        // const files = readdirSync(homePath)
        // files.forEach(f => {
        //   const data = readFileSync(join(homePath, f))
        //   writeFileSync(join(wdPath, f), data)
        // })
    }
    await setupSiteFiles(publicDir);
    site.set("/", site.get(g_config.defaultFile));
}
function setupSiteFiles(dir, url = "/") {
    return Promise.allSettled((0, fs_1.readdirSync)(dir).map(async (file) => {
        const path = (0, path_1.join)(dir, file);
        const ext = (0, path_1.extname)(file);
        const fileUrl = joinUrl(url, file);
        if ((await (0, promises_1.stat)(path)).isDirectory())
            return setupSiteFiles(path, fileUrl);
        else if (!g_config.skipExtensions?.includes(ext)) {
            return setupSiteFile(path, ext, fileUrl);
        }
    }));
}
const jsWatchers = [];
const impundledFiles = new Set();
async function setupSiteFile(path, ext, url) {
    const plugin = g_config.plugins?.[ext];
    let file;
    try {
        if (plugin) {
            const { newExtensionName: newExt = ext, content: fileContent, ignore, } = await plugin(path);
            if (ignore)
                return;
            file = fileContent;
            url = url.slice(0, -ext.length) + newExt;
            ext = newExt;
        }
        else if (ext === ".js" || ext === ".ts") {
            setSiteFile(url, Buffer.from(""));
            const urlObj = site.get(url);
            impundledFiles.add(path);
            setCounter("inc");
            return await (0, bundlex_1.impundler)(path, { watch: g_config.watch }, async (str) => {
                urlObj.data = Buffer.from(str);
                setCounter("dec");
            });
        }
        else if (ext === ".jsx" || ext === ".tsx") {
            return handleJSX(path, url);
        }
        else
            file = await (0, promises_1.readFile)(path);
        if (ext === ".html")
            setSiteFile(url, Buffer.from(handleHtmlFile(file, url)));
        else
            setSiteFile(url, file);
    }
    catch (e) {
        console.log(e);
    }
}
const jsxPlugin = {
    ".jsx": (code) => (0, jsxpiler_1.transpileJSX)(code),
    ".tsx": (code) => (0, jsxpiler_1.transpileJSX)(typescript_1.default.transpile(code, {
        module: typescript_1.default.ModuleKind.Node16,
        removeComments: true,
        jsx: typescript_1.default.JsxEmit.Preserve,
        esModuleInterop: true,
    })),
    ".svg": (code) => `export default \`${code}\``,
};
function handleJSX(filePath, url) {
    url = url.slice(0, -4) + ".html";
    impundledFiles.add(filePath);
    setCounter("inc");
    (0, bundlex_1.impundler)(filePath, { watch: g_config.watch, plugins: jsxPlugin }, async (result, bundle) => {
        const { index } = eval(result);
        if (index === undefined) {
            return bundle.unhandle();
        }
        if (index.length === 0) {
            let file = Buffer.from("<!DOCTYPE html>" + index());
            setSiteFile(url, Buffer.from(handleHtmlFile(file, url)));
        }
        else {
            const toHtml = (params, x) => {
                x.headers = {
                    "Content-Type": "text/html",
                };
                return handleHtmlFile(Buffer.from("<!DOCTYPE html>" + index(params, x)), url);
            };
            api.set(url, toHtml);
            handleIndexHtml(url, toHtml, api);
        }
        setCounter("dec");
    });
}
function setSiteFile(url, data, headers = {}) {
    const contentType = getContentType(url);
    site.set(url, {
        headers: {
            "Content-Type": contentType,
            // "Content-Length": data.length,
            ...headers,
        },
        data,
    });
    handleIndexHtml(url, site.get(url), site);
}
function handleIndexHtml(url, value, source) {
    if ((0, path_1.basename)(url) === "index.html") {
        const dirUrl = joinUrl(url, "..");
        source.set(dirUrl, value);
        source.set(dirUrl + ".html", value);
        if (dirUrl === g_config.defaultFile)
            source.set("/", value);
    }
    if (url === g_config.defaultFile)
        source.set("/", value);
}
function handleHtmlFile(data, url) {
    let dataStr = validateLinks(data.toString(), url);
    if (g_config.watch)
        dataStr = dataStr.replace("</body>", "<script>" + cws + "</script>");
    return dataStr;
}
function getContentType(path) {
    switch ((0, path_1.extname)(path)) {
        case ".html":
            return "text/html";
        case ".css":
            return "text/css";
        case ".js":
            return "application/javascript";
        case ".json":
            return "application/json";
        case ".png":
            return "image/png";
        case ".jpg":
            return "image/jpeg";
        case ".gif":
            return "image/gif";
        case ".svg":
            return "image/svg+xml";
        default:
            return "text/plain";
    }
}
let wsServer;
function watchStructure() {
    // it's watching the public directory for change then signal websocket to reload
    wsServer = new websocket_1.server({ httpServer });
    wsServer.on("request", request => {
        const con = request.accept();
        connections.add(con);
        con.on("close", () => {
            connections.delete(con);
        });
    });
    const handledFiles = new Map();
    const watcher = (0, fs_1.watch)(publicDir, { recursive: true }, async (eventType, filename) => {
        const filePath = (0, path_1.join)(publicDir, filename);
        const ext = (0, path_1.extname)(filename);
        if (ext === "" || impundledFiles.has(filePath))
            return;
        else if (handledFiles.has(filename))
            return handledFiles.get(filename)();
        if (eventType === "rename") {
            try {
                await (0, promises_1.access)(filePath);
            }
            catch (e) {
                removeUrl(joinUrl(filename));
                return setCounter("dec");
            }
        }
        setTimeout(() => {
            handledFiles.clear();
        }, 300);
        const d = (0, vaco_1.debounce)(async () => {
            const isLoad = g_config.reloadExtRgx?.test(ext);
            isLoad && setCounter("inc");
            await setupSiteFile(filePath, ext, joinUrl(filename));
            isLoad && setCounter("dec");
        }, 100);
        d();
        handledFiles.set(filename, d);
    });
    jsWatchers.push(watcher);
}
const indexExts = /\.[jt]sx$/;
async function removeUrl(url) {
    if (site.has(url))
        removeSiteUrl(url, site);
    else if (indexExts.test(url)) {
        const xUrl = url.slice(0, -4) + ".html";
        if (site.has(url))
            removeSiteUrl(xUrl, site);
        else if (api.has(xUrl))
            removeSiteUrl(xUrl, api);
    }
}
function removeSiteUrl(url, source) {
    source.set(url, source.get(g_config.notFound) || nf);
    handleIndexHtml(url, source.get(g_config.notFound) || nf, source);
}
function joinUrl(...args) {
    return ("/" +
        args
            .map(a => a
            .replaceAll("\\", "/")
            .split("/")
            .filter(v => v !== "" && v !== "."))
            .filter(ar => ar.length !== 0)
            .flat()
            .reduce((acc, v) => {
            v === ".." ? acc.pop() : acc.push(v);
            return acc;
        }, [])
            .join("/"));
}
function validateLinks(data, baseUrl) {
    const url = baseUrl.split("/").slice(0, -1).join("/");
    return data.replaceAll(/(href|src)="\.([^"]+)"/g, (m, p1, p2) => `${p1}="${joinUrl(url, p2)}"`);
}
const apiFolderPath = (0, path_1.join)(process.cwd(), "./api");
async function initApi() {
    try {
        await (0, promises_1.access)(apiFolderPath);
    }
    catch (e) {
        return console.log("there is no api folder");
    }
    await setApiFolder(apiFolderPath);
}
const clientApiFolderPath = (0, path_1.join)(process.cwd(), "./clientApi");
async function setApiFolder(dir, pre = "/") {
    try {
        await (0, promises_1.access)(clientApiFolderPath);
    }
    catch (e) {
        await (0, promises_1.mkdir)(clientApiFolderPath);
    }
    await Promise.allSettled((0, fs_1.readdirSync)(dir).map(async (file) => {
        const path = (0, path_1.join)(dir, file);
        const ext = (0, path_1.extname)(file);
        if (ext === apiExt) {
            return setApi(path, pre + file.slice(0, -3) + "/");
        }
        else if ((await (0, promises_1.stat)(path)).isDirectory())
            return setApiFolder(path, pre + file + "/");
    }));
}
function setApi(path, pre) {
    impundledFiles.add(path);
    return (0, bundlex_1.impundler)(path, { watch: g_config.watch, bundleNodeModules: false }, async (code) => {
        setCounter("inc");
        try {
            const oApi = eval(code);
            for (const name in oApi)
                api.set(pre + name, oApi[name]);
            await genFile(path, oApi);
        }
        catch (e) {
            console.warn("failed to evaluate api at: " + path);
            if (g_config.watch) {
                console.warn(e);
            }
            else
                throw e;
        }
        setCounter("dec");
    });
}
async function genFile(filePath, api) {
    let ret;
    switch ((0, path_1.extname)(filePath)) {
        case ".js":
            ret = await generateClientApiFileJS(filePath, api);
            break;
        case ".ts":
            ret = await generateClientApiFileTS(filePath, api);
            break;
    }
    await (0, promises_1.writeFile)((0, path_1.join)(clientApiFolderPath, filePath.slice(apiFolderPath.length, -3) + apiExt), ret);
}
async function generateClientApiFileJS(filePath, api) {
    return `module.exports = {
    ${Object.keys(api)
        .map(name => `${name}: (data, options={}) => {
      return fetch("${filePath.slice(0, -3)}", {
        method: "POST",
        body: JSON.stringify(data),
        ...options
      })
    }`)
        .join()}
  }`;
}
async function generateClientApiFileTS(filePath, api) {
    const apiPath = filePath.slice(apiFolderPath.length, -3).replaceAll("\\", "/");
    return `import * as __oApi from "../api${apiPath}"\n
    ${Object.keys(api)
        .filter(name => name !== "__esModule")
        .map(name => `export function ${name} (${api[name].length === 0
        ? ""
        : `data:Parameters<typeof __oApi.${name}>[0], `}options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.${name}>>, Record<any, any>>
  type RetType =  ObjRetType extends never 
    ? Omit<Response, "json"> & {
      json: () => Promise<never>
    }
    : Omit<Response, "json"> & {
        json: () => Promise<ObjRetType>
      }
  return fetch("${apiPath}/${name}"
    ${api[name].length === 0
        ? ", options"
        : `, {method: "POST",body: JSON.stringify(data),...options}`}
    ) as Promise<RetType>
}`)
        .join("\n")}
  `;
}
startServer();
function terminate() {
    console.log("terminating...");
    jsWatchers.forEach(w => w.close());
    wsServer.closeAllConnections();
    httpServer.close();
    (0, bundlex_1.closeAllBundles)();
}
process.on("SIGINT", () => process.exit());
process.on("SIGTERM", () => process.exit());
process.on("exit", terminate);
process.on("uncaughtException", e => {
    console.warn(e);
});
process.on("unhandledRejection", e => {
    console.warn(e);
});
