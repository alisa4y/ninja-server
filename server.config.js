module.exports = {
  port: 3000,
  host: "localhost",
  protocol: "http",
  publicDir: "public",
  defaultFile: "home",
  watch: true,
  apiExtension: ".ts", // .ts .js
  skipExtensions: [], // skip watching files with these extensions in publicDir
  reloadExtRgx: /^(?:(?!\.css).)+$/, // reload control pattern . default is server won't send reload signal for css files
  plugins: {}, // { [extension] : (filename:string) => ({newExtension:string, content:string, ignore: boolean}) }
}
