import assert from "node:assert/strict"
import test from "node:test"

import { fromMarkdown, toMarkdown } from "@/components/ui/editor/lib/markdown"

/** Ida e volta: o texto precisa sobreviver ao documento sem perder informação. */
function roundTrip(markdown: string): string {
  return toMarkdown(fromMarkdown(markdown)).trim()
}

test("mantém parágrafos e marcas inline", () => {
  const entrada = "Texto com **negrito**, *itálico*, ~~riscado~~ e `código`."
  assert.equal(roundTrip(entrada), entrada)
})

test("mantém títulos de nível 1 a 3", () => {
  const entrada = "# Um\n\n## Dois\n\n### Três"
  assert.equal(roundTrip(entrada), entrada)
})

test("mantém links com texto", () => {
  const entrada = "Veja o [painel](https://exemplo.test/painel)."
  assert.equal(roundTrip(entrada), entrada)
})

test("mantém listas com marcador e numeradas", () => {
  assert.equal(roundTrip("- um\n- dois"), "- um\n- dois")
  assert.equal(roundTrip("1. um\n2. dois"), "1. um\n2. dois")
})

test("mantém lista de tarefas marcada e desmarcada", () => {
  const entrada = "- [ ] pendente\n- [x] feita"
  assert.equal(roundTrip(entrada), entrada)
})

test("lê o estado do item de tarefa no documento", () => {
  const doc = fromMarkdown("- [x] feita\n- [ ] pendente")
  const lista = doc.firstChild

  assert.equal(lista?.type.name, "task_list")
  assert.equal(lista?.child(0).attrs.checked, true)
  assert.equal(lista?.child(1).attrs.checked, false)
})

test("mantém citação e bloco de código com linguagem", () => {
  assert.equal(roundTrip("> citação"), "> citação")
  assert.equal(roundTrip("```ts\nconst a = 1\n```"), "```ts\nconst a = 1\n```")
})

test("mantém imagem com texto alternativo", () => {
  const entrada = "![Diagrama](https://exemplo.test/imagem.png)"
  assert.equal(roundTrip(entrada), entrada)
})

test("mantém régua horizontal", () => {
  assert.equal(roundTrip("---"), "---")
})

test("documento vazio serializa como texto vazio", () => {
  assert.equal(roundTrip(""), "")
})

test("HTML no texto entra como texto, nunca como marcação", () => {
  const doc = fromMarkdown("<script>alert(1)</script>")

  assert.equal(doc.childCount, 1)
  assert.equal(doc.firstChild?.type.name, "paragraph")
  assert.equal(doc.firstChild?.textContent, "<script>alert(1)</script>")
})

test("preserva quebra de linha dentro do parágrafo", () => {
  const doc = fromMarkdown("linha um\\\nlinha dois")
  assert.equal(doc.firstChild?.childCount, 3)
  assert.equal(doc.firstChild?.child(1).type.name, "hard_break")
})

test("mantém aninhamento de lista", () => {
  const entrada = "- pai\n  - filho"
  assert.equal(roundTrip(entrada), entrada)
})
