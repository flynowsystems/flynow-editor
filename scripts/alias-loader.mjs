/**
 * Os arquivos do editor se importam pelo caminho que terão no projeto consumidor
 * (`@/components/ui/editor/...`), que é o que o estilo shadcn exige. Nos testes,
 * este hook traduz esse prefixo para o diretório do registry.
 */
import { register } from "node:module"
import { pathToFileURL } from "node:url"

const PREFIX = "@/components/ui/editor/"
const raiz = new URL("../registry/flynow-editor/", import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith(PREFIX)) return nextResolve(specifier, context)

  const relativo = specifier.slice(PREFIX.length)
  const candidatos = [`${relativo}.ts`, `${relativo}.tsx`, relativo]

  for (const candidato of candidatos) {
    const url = new URL(candidato, raiz)
    try {
      return await nextResolve(url.href, context)
    } catch {
      continue
    }
  }

  return nextResolve(specifier, context)
}

register(pathToFileURL(new URL(import.meta.url).pathname))
