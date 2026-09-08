import assert from "node:assert/strict"
import test from "node:test"
import { EditorState, TextSelection, type Transaction } from "prosemirror-state"
import type { Command } from "prosemirror-state"

import {
  isBlockActive,
  isListActive,
  isMarkActive,
  toggleBlockquote,
  toggleCodeBlock,
  toggleEm,
  toggleHeading,
  toggleList,
  toggleStrong,
} from "@/components/ui/editor/commands"
import { fromMarkdown, toMarkdown } from "@/components/ui/editor/lib/markdown"
import { buildInputRules } from "@/components/ui/editor/plugins/input-rules"
import { schema } from "@/components/ui/editor/schema"

const inputRules = buildInputRules()

/** View mínima: as regras de digitação só usam `state` e `dispatch`. */
function makeView(state: EditorState) {
  const view = {
    state,
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr)
    },
  }

  return view
}

/**
 * Digita caractere a caractere, que é como o ProseMirror recebe de um teclado real:
 * cada tecla passa pelas regras antes de virar texto.
 */
function type(markdownInicial: string, texto: string): EditorState {
  const state = EditorState.create({ doc: fromMarkdown(markdownInicial), plugins: [inputRules] })
  const view = makeView(state)

  for (const caractere of texto) {
    const { from, to } = view.state.selection
    const tratado = inputRules.props.handleTextInput?.call(
      inputRules,
      view as never,
      from,
      to,
      caractere,
      () => null as never
    )

    if (!tratado) view.dispatch(view.state.tr.insertText(caractere, from, to))
  }

  return view.state
}

test('"# " no começo da linha vira título', () => {
  const state = type("", "# Titulo")
  assert.equal(state.doc.firstChild?.type.name, "heading")
  assert.equal(state.doc.firstChild?.attrs.level, 1)
  assert.equal(toMarkdown(state.doc).trim(), "# Titulo")
})

test('"### " respeita o nível', () => {
  const state = type("", "### Terceiro")
  assert.equal(state.doc.firstChild?.attrs.level, 3)
})

test('"- " abre lista com marcador', () => {
  const state = type("", "- item")
  assert.equal(state.doc.firstChild?.type.name, "bullet_list")
  assert.equal(toMarkdown(state.doc).trim(), "- item")
})

test('"1. " abre lista numerada', () => {
  const state = type("", "1. item")
  assert.equal(state.doc.firstChild?.type.name, "ordered_list")
})

test('"[ ] " abre lista de tarefas', () => {
  const state = type("", "[ ] tarefa")
  assert.equal(state.doc.firstChild?.type.name, "task_list")
  assert.equal(toMarkdown(state.doc).trim(), "- [ ] tarefa")
})

test('"> " abre citação', () => {
  const state = type("", "> citação")
  assert.equal(state.doc.firstChild?.type.name, "blockquote")
})

test('"```" abre o bloco de código na terceira crase', () => {
  const state = type("", "```")

  assert.equal(state.doc.firstChild?.type.name, "code_block")
  // A linguagem nasce vazia: quem escolhe é a barra do próprio bloco.
  assert.equal(state.doc.firstChild?.attrs.language, null)
})

test("linguagem escolhida na barra vai para a cerca do Markdown", () => {
  const state = EditorState.create({ doc: fromMarkdown("```\nconst a = 1\n```") })
  const comLinguagem = state.apply(
    state.tr.setNodeMarkup(0, undefined, { language: "typescript" })
  )

  assert.equal(toMarkdown(comLinguagem.doc).trim(), "```typescript\nconst a = 1\n```")
})

test("marcação inline vira marca ao fechar", () => {
  assert.equal(toMarkdown(type("", "peso **forte**").doc).trim(), "peso **forte**")
  assert.equal(toMarkdown(type("", "peso *leve*").doc).trim(), "peso *leve*")
  assert.equal(toMarkdown(type("", "peso ~~fora~~").doc).trim(), "peso ~~fora~~")
  assert.equal(toMarkdown(type("", "veja `codigo`").doc).trim(), "veja `codigo`")
})

/** Estado com o texto inteiro selecionado, como depois de um duplo clique. */
function selectAll(markdown: string): EditorState {
  const state = EditorState.create({ doc: fromMarkdown(markdown) })
  const selecao = TextSelection.create(state.doc, 1, state.doc.content.size - 1)

  return state.apply(state.tr.setSelection(selecao))
}

/** Roda o comando e devolve o estado resultante. */
function apply(state: EditorState, command: Command): EditorState {
  let resultado = state
  command(state, (tr) => {
    resultado = state.apply(tr)
  })

  return resultado
}

test("negrito aplicado pela barra cobre a seleção", () => {
  const marcado = apply(selectAll("palavra"), toggleStrong())

  assert.ok(isMarkActive(marcado, schema.marks.strong))
  assert.equal(toMarkdown(marcado.doc).trim(), "**palavra**")
})

test("título e citação alternam pelo comando", () => {
  const base = EditorState.create({ doc: fromMarkdown("texto") })

  const comTitulo = apply(base, toggleHeading(2))
  assert.ok(isBlockActive(comTitulo, schema.nodes.heading, { level: 2 }))

  const semTitulo = apply(comTitulo, toggleHeading(2))
  assert.ok(isBlockActive(semTitulo, schema.nodes.paragraph))

  const citado = apply(base, toggleBlockquote())
  assert.equal(citado.doc.firstChild?.type.name, "blockquote")

  const semCitacao = apply(citado, toggleBlockquote())
  assert.equal(semCitacao.doc.firstChild?.type.name, "paragraph")
})

test("lista alterna e desfaz sem perder o texto", () => {
  const base = EditorState.create({ doc: fromMarkdown("item") })

  const comLista = apply(base, toggleList(schema.nodes.bullet_list))
  assert.ok(isListActive(comLista, schema.nodes.bullet_list))

  const semLista = apply(comLista, toggleList(schema.nodes.bullet_list))
  assert.equal(semLista.doc.textContent, "item")
  assert.ok(!isListActive(semLista, schema.nodes.bullet_list))
})

test("lista com marcador vira lista de tarefas mantendo o item", () => {
  const base = EditorState.create({ doc: fromMarkdown("- item") })
  const tarefas = apply(base, toggleList(schema.nodes.task_list))

  assert.ok(isListActive(tarefas, schema.nodes.task_list))
  assert.equal(tarefas.doc.textContent, "item")
})

test("bloco de código alterna e preserva o texto", () => {
  const base = EditorState.create({ doc: fromMarkdown("const a = 1") })
  const codigo = apply(base, toggleCodeBlock())

  assert.ok(isBlockActive(codigo, schema.nodes.code_block))
  assert.equal(codigo.doc.textContent, "const a = 1")
  assert.equal(toMarkdown(codigo.doc).trim(), "```\nconst a = 1\n```")
})

test("itálico marca e desmarca a mesma seleção", () => {
  const marcado = apply(selectAll("palavra"), toggleEm())
  assert.ok(isMarkActive(marcado, schema.marks.em))

  const desmarcado = apply(marcado, toggleEm())
  assert.ok(!isMarkActive(desmarcado, schema.marks.em))
})
