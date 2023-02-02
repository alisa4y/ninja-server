import * as __oApi from "../api/api"

    export function reset (options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.reset>>, Record<any, any>>
  return fetch("/api/reset"
    , options
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export function login (data:Parameters<typeof __oApi.login>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.login>>, Record<any, any>>
  return fetch("/api/login"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export function add (data:Parameters<typeof __oApi.add>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.add>>, Record<any, any>>
  return fetch("/api/add"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export function greet (options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.greet>>, Record<any, any>>
  return fetch("/api/greet"
    , options
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export function manipulateRuntimeIndex (data:Parameters<typeof __oApi.manipulateRuntimeIndex>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.manipulateRuntimeIndex>>, Record<any, any>>
  return fetch("/api/manipulateRuntimeIndex"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
export function changeApiAtRuttime (data:Parameters<typeof __oApi.changeApiAtRuttime>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.changeApiAtRuttime>>, Record<any, any>>
  return fetch("/api/changeApiAtRuttime"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
  