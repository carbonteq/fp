import { readFileSync, writeFileSync } from "node:fs"

const pkgBuff = readFileSync("./package.json")
const pkg = JSON.parse(pkgBuff)

const jsrBuff = readFileSync("./deno.jsonc")
const jsrCurr = JSON.parse(jsrBuff)

if (jsrCurr.version !== pkg.version) {
  console.log("Updating deno version")
  jsrCurr.version = pkg.version

  writeFileSync("./deno.jsonc", JSON.stringify(jsrCurr, null, 2))
} else {
  console.log("deno version already up to date")
}
