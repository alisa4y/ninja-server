import { sayHi } from "../../api/greet"
export function index() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>greet</title>
      </head>
      <body>
        <h1>{sayHi().msg}</h1>
        <h2 id="Mr"></h2>
        <h2 id="Mrs"></h2>
        <script src="./index.ts"></script>
      </body>
    </html>
  )
}
