import * as __oApi from "../api/greet"

    export function sayHi (options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi.sayHi>>, Record<any, any>>
  return fetch("/greet/sayHi"
    , options
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
  