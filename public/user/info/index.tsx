import { Greet } from "./components"
export function index({ fname, lname }: { fname: string; lname: string }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document</title>
        <link href="/index.css" rel="stylesheet" />
      </head>
      <body>
        <Greet fname={fname} lname={lname} />
      </body>
    </html>
  )
}
