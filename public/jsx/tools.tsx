export function Layout({
  title,
  list,
  children,
}: {
  title: string
  list: string[]
  children: any
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
      </head>
      <body>
        <header>{list.map(n => <div>{n}</div>).join("")}</header>
        <main>{children}</main>
      </body>
      <script src="./index.ts"></script>
    </html>
  )
}
