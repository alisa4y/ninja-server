import * as __oApi from "../api/api"

    export function reset (data:Parameters<typeof __oApi.reset>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.reset>>, Record<any, any>>
  type RetType =  ObjRetType extends never 
    ? Omit<Response, "json"> & {
      json: () => Promise<never>
    }
    : Omit<Response, "json"> & {
        json: () => Promise<ObjRetType>
      }
  return fetch("/api/reset", {
    method: "POST",
    body: JSON.stringify(data),
    ...options
  }) as Promise<RetType>
}
export function login (data:Parameters<typeof __oApi.login>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.login>>, Record<any, any>>
  type RetType =  ObjRetType extends never 
    ? Omit<Response, "json"> & {
      json: () => Promise<never>
    }
    : Omit<Response, "json"> & {
        json: () => Promise<ObjRetType>
      }
  return fetch("/api/login", {
    method: "POST",
    body: JSON.stringify(data),
    ...options
  }) as Promise<RetType>
}
export function add (data:Parameters<typeof __oApi.add>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.add>>, Record<any, any>>
  type RetType =  ObjRetType extends never 
    ? Omit<Response, "json"> & {
      json: () => Promise<never>
    }
    : Omit<Response, "json"> & {
        json: () => Promise<ObjRetType>
      }
  return fetch("/api/add", {
    method: "POST",
    body: JSON.stringify(data),
    ...options
  }) as Promise<RetType>
}
export function greet (data:Parameters<typeof __oApi.greet>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.greet>>, Record<any, any>>
  type RetType =  ObjRetType extends never 
    ? Omit<Response, "json"> & {
      json: () => Promise<never>
    }
    : Omit<Response, "json"> & {
        json: () => Promise<ObjRetType>
      }
  return fetch("/api/greet", {
    method: "POST",
    body: JSON.stringify(data),
    ...options
  }) as Promise<RetType>
}
export function manipulateRuntimeIndex (data:Parameters<typeof __oApi.manipulateRuntimeIndex>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.manipulateRuntimeIndex>>, Record<any, any>>
  type RetType =  ObjRetType extends never 
    ? Omit<Response, "json"> & {
      json: () => Promise<never>
    }
    : Omit<Response, "json"> & {
        json: () => Promise<ObjRetType>
      }
  return fetch("/api/manipulateRuntimeIndex", {
    method: "POST",
    body: JSON.stringify(data),
    ...options
  }) as Promise<RetType>
}
  