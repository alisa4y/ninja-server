"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const http_1 = require("http");
const websocket_1 = require("websocket");
const flowco_1 = require("flowco");
const path_1 = require("path");
const js_bundler_1 = require("js-bundler");
const Url = __importStar(require("url"));
const ts_node_1 = require("ts-node");
// import { minify } from "html-minifier-terser"
let g_config;
const configFileName = "server.config.js";
const projectConfigFilePath = (0, path_1.join)(process.cwd(), configFileName);
try {
    g_config = require(projectConfigFilePath);
}
catch (e) {
    console.warn(e);
    const configFilePath = (0, path_1.join)(__dirname, "..", configFileName);
    const configFile = (0, fs_1.readFileSync)(configFilePath, "utf8");
    (0, fs_1.writeFileSync)(projectConfigFilePath, configFile);
    g_config = require(projectConfigFilePath);
}
g_config.defaultFile = joinUrl(g_config.defaultFile || "index.html");
const site = new Map();
const api = new Map();
let httpServer;
const { host, port } = g_config;
const uri = port === 80 ? `http://${host}` : `http://${host}:${port}`;
const workingDir = (0, path_1.join)(process.cwd(), g_config.publicDir);
// -------------------------------  watch variables  -------------------------------
const connections = new Set();
const setCounter = (0, flowco_1.cell)((counter, action) => {
    let v = counter;
    switch (action) {
        case "inc":
            v++;
            break;
        case "dec":
            v !== 0 && v--;
            break;
    }
    v === 0 && connections.forEach(c => c.sendUTF("reload"));
    return v;
}, 0);
async function startServer() {
    await setup(workingDir);
    httpServer = (0, http_1.createServer)(handleRequest);
    httpServer.listen(port, host).on("listening", () => {
        console.log(`Server running at ${uri}/`);
    });
    if (g_config.watch)
        watchStructure();
    await initApi();
}
exports.startServer = startServer;
const nf = {
    header: { "Content-Type": "text/plain" },
    data: "Not Found",
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
            try {
                res(JSON.parse(body));
            }
            catch (e) {
                res(body);
            }
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
async function handleRequest(req, res) {
    const { url, method } = req;
    let result = site.get(url);
    if (result === undefined) {
        let data;
        let paramObj;
        const exParam = { req, headers: {}, statusCode: 200 };
        try {
            if (bodyMethod.includes(method)) {
                paramObj = await getBody(req);
            }
            else if (paramMethod.includes(method)) {
                paramObj = Url.parse(url, true).query;
            }
            data = await api.get(stripUrl(url))?.(paramObj, exParam);
        }
        catch (e) {
            exParam.statusCode = 500;
            console.log(e.message);
            data = "something went wrong";
        }
        if (data === undefined) {
            result = site.get(g_config.notFound) || nf;
        }
        else {
            if (data === null)
                data = "";
            result = {
                headers: {
                    "Content-Type": typeof data === "string" ? "text/plain" : "application/json",
                    ...exParam.headers,
                },
                data: typeof data === "string" ? data : JSON.stringify(data),
                statusCode: exParam.statusCode,
            };
        }
    }
    const { headers, data, statusCode = 200 } = result;
    res.writeHead(statusCode, headers);
    res.end(data);
}
async function setup(workingDir) {
    try {
        await (0, promises_1.access)(workingDir, fs_1.constants.F_OK);
    }
    catch (err) {
        (0, fs_1.mkdirSync)(workingDir);
        const wdPath = (0, path_1.join)(workingDir, "home");
        (0, fs_1.mkdirSync)(wdPath);
        const homePath = (0, path_1.join)(__dirname, "../public/home");
        const files = (0, fs_1.readdirSync)(homePath);
        files.forEach(f => {
            const data = (0, fs_1.readFileSync)((0, path_1.join)(homePath, f));
            (0, fs_1.writeFileSync)((0, path_1.join)(wdPath, f), data);
        });
    }
    await setupSiteFiles(workingDir);
    site.set("/", site.get(g_config.defaultFile));
}
async function setupSiteFiles(dir, url = "/") {
    await Promise.allSettled((0, fs_1.readdirSync)(dir).map(async (file) => {
        const path = (0, path_1.join)(dir, file);
        const ext = (0, path_1.extname)(file);
        const fileUrl = joinUrl(url, file);
        if (ext === "")
            await setupSiteFiles(path, fileUrl);
        else if (!g_config.skipExtensions?.includes(ext)) {
            await setupSiteFile(path, ext, fileUrl);
        }
    }));
}
const jsWatchers = [];
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
            setCounter("inc");
            (0, js_bundler_1.impundler)(path, { watch: g_config.watch }, str => {
                urlObj.data = str;
                setCounter("dec");
            }).then(ifile => {
                jsWatchers.push(ifile.watcher);
            });
            return;
        }
        else
            file = await (0, promises_1.readFile)(path);
        if (ext === ".html")
            setSiteFile(url, handleHtmlFile(file, url));
        else
            setSiteFile(url, file);
    }
    catch (e) {
        console.log(e);
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
]);
function setSiteFile(url, data, headers = {}) {
    const contentType = getContentType(url);
    site.set(url, {
        header: {
            "Content-Type": contentType,
            // "Content-Length": data.length,
            ...headers,
        },
        data,
    });
    if ((0, path_1.basename)(url) === "index.html") {
        const dirUrl = joinUrl(url, "..");
        site.set(dirUrl, site.get(url));
        site.set(dirUrl + ".html", site.get(url));
        if (dirUrl === g_config.defaultFile)
            site.set("/", site.get(url));
    }
    if (url === g_config.defaultFile)
        site.set("/", site.get(url));
}
const cws = `const __socket = new WebSocket('ws://${host}:${port}');
__socket.addEventListener('open', function (event) {
    __socket.send('Hello Server!');
});
__socket.addEventListener('message', function (event) {
    if(event.data === 'reload') window.location.reload();
});`;
function handleHtmlFile(data, url) {
    let dataStr = validateLinks(data.toString(), url);
    if (g_config.watch)
        dataStr = dataStr.replace("</body>", "<script>" + cws + "</script>");
    return Buffer.from(dataStr);
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
let wsServer, watcher;
function watchStructure() {
    wsServer = new websocket_1.server({ httpServer });
    wsServer.on("request", request => {
        const con = request.accept();
        connections.add(con);
        con.on("close", () => {
            connections.delete(con);
        });
    });
    const isReloadExtRgx = g_config.reloadExtRgx;
    watcher = (0, fs_1.watch)(workingDir, { recursive: true }, (0, flowco_1.shield)(async (eventType, filename) => {
        const ext = (0, path_1.extname)(filename);
        if (eventType === "change" && ext !== "") {
            const isLoad = isReloadExtRgx?.test(ext);
            isLoad && setCounter("inc");
            if (ext !== ".js") {
                const url = joinUrl(filename);
                await setupSiteFile((0, path_1.join)(workingDir, filename), ext, url);
                isLoad && setCounter("dec");
            }
        }
    }, 300));
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
        await setApiFolder(apiFolderPath);
    }
    catch (e) {
        console.log("there is no api folder");
    }
}
const clientApiFolderPath = (0, path_1.join)(process.cwd(), "./clientApi");
const apiExt = g_config.apiExtension;
if (apiExt === ".ts")
    (0, ts_node_1.register)({ typeCheck: false });
const apiWatchers = [];
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
            addApi(path, pre + file.slice(0, -3) + "/");
            genFile(path);
            if (g_config.watch)
                apiWatchers.push((0, fs_1.watch)(path, (0, flowco_1.shield)(eventType => {
                    if (eventType === "change")
                        genFile(path);
                }, 300)));
        }
        else if (ext === "")
            await setApiFolder(path, pre + file + "/");
    }));
}
async function addApi(path, pre) {
    const oApi = require(path);
    for (const name in oApi) {
        const f = oApi[name];
        api.set(pre + name, f);
    }
}
async function genFile(filePath) {
    let ret;
    switch ((0, path_1.extname)(filePath)) {
        case ".js":
            ret = await generateClientApiFileJS(filePath);
            break;
        case ".ts":
            ret = await generateClientApiFileTS(filePath);
            break;
    }
    await (0, promises_1.writeFile)((0, path_1.join)(clientApiFolderPath, filePath.slice(apiFolderPath.length, -3) + apiExt), ret);
}
async function generateClientApiFileJS(filePath) {
    const oApi = require(filePath);
    return `module.exports = {
    ${Object.keys(oApi)
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
async function generateClientApiFileTS(filePath) {
    const oApi = require(filePath);
    const oApiPath = filePath
        .slice(apiFolderPath.length, -3)
        .replaceAll("\\", "/");
    return `import * as __oApi from "../api${oApiPath}"\n
    ${Object.keys(oApi)
        .filter(name => name !== "__esModule")
        .map(name => `export function ${name} (data:Parameters<typeof __oApi.${name}>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.${name}>>, Record<any, any>>
  type RetType =  ObjRetType extends never 
    ? Omit<Response, "json"> & {
      json: () => Promise<never>
    }
    : Omit<Response, "json"> & {
        json: () => Promise<ObjRetType>
      }
  return fetch("${oApiPath}/${name}", {
    method: "POST",
    body: JSON.stringify(data),
    ...options
  }) as Promise<RetType>
}`)
        .join("\n")}
  `;
}
startServer();
function terminate() {
    console.log("terminating...");
    watcher.close();
    wsServer.closeAllConnections();
    httpServer.close();
    jsWatchers.forEach(w => w.close());
    apiWatchers.forEach(w => w.close());
}
process.on("SIGINT", () => process.exit());
process.on("SIGTERM", () => process.exit());
process.on("exit", terminate);
