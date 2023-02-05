import * as __oApi from "../api/api"

    export const reset = function (options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["reset"]>>, Record<any, any>>
  return fetch("/api/reset"
    , options
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const login = function (data:Parameters<typeof __oApi["login"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["login"]>>, Record<any, any>>
  return fetch("/api/login"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const add = function (data:Parameters<typeof __oApi["add"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["add"]>>, Record<any, any>>
  return fetch("/api/add"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const greet = function (options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["greet"]>>, Record<any, any>>
  return fetch("/api/greet"
    , options
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const manipulateRuntimeIndex = function (data:Parameters<typeof __oApi["manipulateRuntimeIndex"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["manipulateRuntimeIndex"]>>, Record<any, any>>
  return fetch("/api/manipulateRuntimeIndex"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const changeApiAtRuttime = function (data:Parameters<typeof __oApi["changeApiAtRuttime"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["changeApiAtRuttime"]>>, Record<any, any>>
  return fetch("/api/changeApiAtRuttime"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const cmdApiFile = function (data:Parameters<typeof __oApi["cmdApiFile"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["cmdApiFile"]>>, Record<any, any>>
  return fetch("/api/cmdApiFile"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const cmdApiFolder = function (data:Parameters<typeof __oApi["cmdApiFolder"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["cmdApiFolder"]>>, Record<any, any>>
  return fetch("/api/cmdApiFolder"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const cmdPubFile = function (data:Parameters<typeof __oApi["cmdPubFile"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["cmdPubFile"]>>, Record<any, any>>
  return fetch("/api/cmdPubFile"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export const cmdPubFolder = function (data:Parameters<typeof __oApi["cmdPubFolder"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["cmdPubFolder"]>>, Record<any, any>>
  return fetch("/api/cmdPubFolder"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
  