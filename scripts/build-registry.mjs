#!/usr/bin/env node
/**
 * Gera os arquivos que o CLI do shadcn consome. Cada item vira um JSON com o
 * conteúdo dos arquivos embutido, para ser servido em /r/<item>.json.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..")
const registry = JSON.parse(await readFile(join(raiz, "registry.json"), "utf8"))
const saida = join(raiz, "docs", "r")

await mkdir(saida, { recursive: true })

for (const item of registry.items) {
  const files = await Promise.all(
    item.files.map(async (file) => ({
      path: file.path,
      type: file.type,
      target: file.target,
      content: await readFile(join(raiz, file.path), "utf8"),
    }))
  )

  const conteudo = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    dependencies: item.dependencies,
    files,
  }

  await writeFile(join(saida, `${item.name}.json`), `${JSON.stringify(conteudo, null, 2)}\n`)
  console.log(`→ docs/r/${item.name}.json (${files.length} arquivos)`)
}
