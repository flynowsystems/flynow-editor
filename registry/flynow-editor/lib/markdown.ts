import MarkdownIt from "markdown-it"
import { MarkdownParser, MarkdownSerializer, type MarkdownSerializerState } from "prosemirror-markdown"
import type { Node as ProseNode } from "prosemirror-model"

import { schema } from "@/components/ui/editor/schema"

const TASK_PREFIX = /^\[([ xX])\]\s+/

/**
 * Só o que a regra usa do token do markdown-it. Descrever aqui evita depender do
 * caminho interno dos tipos, que muda entre versões e entre resoluções de módulo.
 */
type MarkdownToken = {
  type: string
  tag: string
  level: number
  content: string
  children?: MarkdownToken[] | null
  attrGet: (name: string) => string | null
  attrSet: (name: string, value: string) => void
}

/** Só o gancho de regras é usado; tipar assim independe da versão do markdown-it. */
type MarkdownItLike = {
  core: {
    ruler: {
      after: (
        anterior: string,
        nome: string,
        regra: (state: { tokens: MarkdownToken[] }) => boolean
      ) => void
    }
  }
}

/**
 * Listas de tarefa não existem no CommonMark. A regra reescreve os tokens da lista
 * em `task_list`/`task_item` quando os itens começam com `[ ]` ou `[x]`, e tira o
 * prefixo do texto — assim o parser do editor recebe nós próprios.
 */
function taskListPlugin(md: MarkdownItLike): void {
  md.core.ruler.after("inline", "task_list", (state) => {
    const tokens = state.tokens

    for (let index = 0; index < tokens.length; index++) {
      const abertura = tokens[index]
      if (abertura.type !== "bullet_list_open") continue

      const fechamento = tokens.findIndex(
        (token, posicao) => posicao > index && token.type === "bullet_list_close" && token.level === abertura.level
      )
      if (fechamento === -1) continue

      const itens = marcarItens(tokens, index + 1, fechamento, abertura.level + 1)
      if (itens === 0) continue

      abertura.type = "task_list_open"
      abertura.tag = "ul"
      tokens[fechamento].type = "task_list_close"
      tokens[fechamento].tag = "ul"
    }

    return true
  })
}

/** Marca os itens da lista que são tarefa e devolve quantos foram convertidos. */
function marcarItens(tokens: MarkdownToken[], inicio: number, fim: number, level: number): number {
  let convertidos = 0

  for (let index = inicio; index < fim; index++) {
    const token = tokens[index]
    if (token.type !== "list_item_open" || token.level !== level) continue

    const conteudo = tokens
      .slice(index + 1, fim)
      .find((candidato) => candidato.type === "inline")
    const marcado = conteudo?.content.match(TASK_PREFIX)
    if (!conteudo || !marcado) continue

    conteudo.content = conteudo.content.replace(TASK_PREFIX, "")
    // O primeiro filho do inline carrega o mesmo texto e é o que o parser lê.
    const primeiro = conteudo.children?.[0]
    if (primeiro?.type === "text") primeiro.content = primeiro.content.replace(TASK_PREFIX, "")

    token.type = "task_item_open"
    token.attrSet("checked", marcado[1] === " " ? "false" : "true")

    const fechamentoItem = tokens.findIndex(
      (candidato, posicao) =>
        posicao > index && candidato.type === "list_item_close" && candidato.level === token.level
    )
    if (fechamentoItem !== -1) tokens[fechamentoItem].type = "task_item_close"

    convertidos++
  }

  return convertidos
}

const markdownIt = MarkdownIt("commonmark", { html: false, linkify: true })
  .enable(["strikethrough", "linkify"])
  .use(taskListPlugin as Parameters<ReturnType<typeof MarkdownIt>["use"]>[0])

/** Markdown → documento do editor. */
export const markdownParser = new MarkdownParser(schema, markdownIt, {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: { block: "bullet_list" },
  ordered_list: {
    block: "ordered_list",
    getAttrs: (token) => ({ order: Number(token.attrGet("start")) || 1 }),
  },
  task_list: { block: "task_list" },
  task_item: {
    block: "task_item",
    getAttrs: (token) => ({ checked: token.attrGet("checked") === "true" }),
  },
  heading: {
    block: "heading",
    getAttrs: (token) => ({ level: Math.min(Number(token.tag.slice(1)), 3) }),
  },
  code_block: { block: "code_block", noCloseToken: true },
  fence: {
    block: "code_block",
    getAttrs: (token) => ({ language: token.info || null }),
    noCloseToken: true,
  },
  hr: { node: "horizontal_rule" },
  image: {
    node: "image",
    getAttrs: (token) => ({
      src: token.attrGet("src"),
      title: token.attrGet("title") || null,
      alt: token.children?.[0]?.content || null,
    }),
  },
  hardbreak: { node: "hard_break" },
  em: { mark: "em" },
  strong: { mark: "strong" },
  s: { mark: "strike" },
  link: {
    mark: "link",
    getAttrs: (token) => ({
      href: token.attrGet("href"),
      title: token.attrGet("title") || null,
    }),
  },
  code_inline: { mark: "code", noCloseToken: true },
})

/** Escapa o que o serializador padrão trataria como marcação. */
function serializeTaskItem(state: MarkdownSerializerState, node: ProseNode): void {
  state.write(node.attrs.checked ? "[x] " : "[ ] ")
  state.renderContent(node)
}

/** Documento do editor → Markdown. */
export const markdownSerializer = new MarkdownSerializer(
  {
    blockquote: (state, node) => {
      state.wrapBlock("> ", null, node, () => state.renderContent(node))
    },
    code_block: (state, node) => {
      const language = node.attrs.language ?? ""
      state.write(`\`\`\`${language}\n`)
      state.text(node.textContent, false)
      state.ensureNewLine()
      state.write("```")
      state.closeBlock(node)
    },
    heading: (state, node) => {
      state.write(`${"#".repeat(node.attrs.level)} `)
      state.renderInline(node)
      state.closeBlock(node)
    },
    horizontal_rule: (state, node) => {
      state.write("---")
      state.closeBlock(node)
    },
    bullet_list: (state, node) => {
      state.renderList(node, "  ", () => "- ")
    },
    ordered_list: (state, node) => {
      const inicio = node.attrs.order || 1
      const largura = String(inicio + node.childCount - 1).length
      const recuo = " ".repeat(largura + 2)

      state.renderList(node, recuo, (index) => {
        const numero = String(inicio + index)
        return `${" ".repeat(largura - numero.length)}${numero}. `
      })
    },
    list_item: (state, node) => {
      state.renderContent(node)
    },
    task_list: (state, node) => {
      state.renderList(node, "  ", () => "- ")
    },
    task_item: serializeTaskItem,
    paragraph: (state, node) => {
      state.renderInline(node)
      state.closeBlock(node)
    },
    image: (state, node) => {
      const alt = state.esc(node.attrs.alt || "")
      const src = node.attrs.src.replace(/[()]/g, "\\$&")
      const title = node.attrs.title ? ` "${node.attrs.title.replace(/"/g, '\\"')}"` : ""
      state.write(`![${alt}](${src}${title})`)
    },
    hard_break: (state, node, parent, index) => {
      // Duas barras invertidas seriam ruído: o padrão é dois espaços e quebra.
      for (let posterior = index + 1; posterior < parent.childCount; posterior++) {
        if (parent.child(posterior).type !== node.type) {
          state.write("\\\n")
          return
        }
      }
    },
    text: (state, node) => {
      state.text(node.text ?? "")
    },
  },
  {
    em: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
    strong: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    link: {
      open: () => "[",
      close: (_state, mark) => {
        const title = mark.attrs.title ? ` "${mark.attrs.title.replace(/"/g, '\\"')}"` : ""
        return `](${mark.attrs.href.replace(/[()]/g, "\\$&")}${title})`
      },
    },
    code: {
      open: (_state, _mark, parent, index) => backticksFor(parent.child(index), -1),
      close: (_state, _mark, parent, index) => backticksFor(parent.child(index - 1), 1),
      escape: false,
    },
  }
)

/** Quantas crases o trecho precisa para não colidir com o próprio conteúdo. */
function backticksFor(node: ProseNode, lado: number): string {
  const encontradas = /`+/g
  let quantidade = 0

  if (node.isText && node.text) {
    let achado = encontradas.exec(node.text)
    while (achado) {
      quantidade = Math.max(quantidade, achado[0].length)
      achado = encontradas.exec(node.text)
    }
  }

  let resultado = quantidade > 0 && lado > 0 ? " `" : "`"
  for (let contador = 0; contador < quantidade; contador++) resultado += "`"
  if (quantidade > 0 && lado < 0) resultado += " "

  return resultado
}

/** Atalhos usados pelo componente e por quem integra o editor. */
export function fromMarkdown(markdown: string): ProseNode {
  return markdownParser.parse(markdown ?? "")
}

export function toMarkdown(doc: ProseNode): string {
  return markdownSerializer.serialize(doc, { tightLists: true })
}
