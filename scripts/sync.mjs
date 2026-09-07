#!/usr/bin/env node
/**
 * Copia os arquivos do editor para um projeto consumidor, no mesmo lugar que o
 * shadcn usaria. Enquanto o registry não está publicado, é assim que se instala:
 *
 *   node scripts/sync.mjs ../../TicketFlow/ticketflow-app
 */
import { cp, mkdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

const destino = process.argv[2]
if (!destino) {
  console.error("uso: node scripts/sync.mjs <caminho-do-projeto>")
  process.exit(1)
}

const registry = JSON.parse(await readFile(new URL("../registry.json", import.meta.url), "utf8"))
const item = registry.items.find((candidate) => candidate.name === "editor")
const raiz = resolve(dirname(new URL(import.meta.url).pathname), "..")
const alvo = resolve(process.cwd(), destino, "src")

for (const file of item.files) {
  const de = join(raiz, file.path)
  const para = join(alvo, file.target)

  await mkdir(dirname(para), { recursive: true })
  await cp(de, para)
  console.log(`→ ${file.target}`)
}

console.log(`\n${item.files.length} arquivos copiados. Dependências necessárias:`)
console.log(`npm install ${item.dependencies.join(" ")}`)
