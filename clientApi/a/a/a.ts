import * as __oApi from "../api/a/a/a"

    export const msg = function (data:Parameters<typeof __oApi["msg"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["msg"]>>, Record<any, any>>
  return fetch("/a/a/a/msg"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}
  