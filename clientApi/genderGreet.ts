import * as __oApi from "../api/genderGreet"

    export const greets = {mr: function (data:Parameters<typeof __oApi["greets"]["mr"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["greets"]["mr"]>>, Record<any, any>>
  return fetch("/genderGreet/greets/mr"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
},mrs: function (data:Parameters<typeof __oApi["greets"]["mrs"]>[0], options:RequestInit={}) {
  type ObjRetType = Extract<Awaited<ReturnType<typeof __oApi["greets"]["mrs"]>>, Record<any, any>>
  return fetch("/genderGreet/greets/mrs"
    , {method: "POST",body: JSON.stringify(data),...options}
  ).then(async res => {
    if (res.ok) return await res.json() as ObjRetType
    else throw new Error(await res.text())
  })
}}
  