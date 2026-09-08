import type { Node as ProseNode } from "prosemirror-model"
import { Plugin, PluginKey, type Transaction } from "prosemirror-state"
import { Decoration, DecorationSet } from "prosemirror-view"

import { isSupported, lowlight } from "@/components/ui/editor/lib/languages"
import { schema } from "@/components/ui/editor/schema"

/** Nó da árvore que o lowlight devolve; só texto e elemento interessam aqui. */
type HastNode = {
  type: string
  value?: string
  tagName?: string
  properties?: { className?: string[] }
  children?: HastNode[]
}

const highlightKey = new PluginKey<DecorationSet>("flynow-editor-highlight")

/** Percorre a árvore acumulando o deslocamento e emite uma decoração por token. */
function collect(
  nodes: HastNode[],
  inicio: number,
  classes: string[],
  saida: Decoration[]
): number {
  let posicao = inicio

  for (const node of nodes) {
    if (node.type === "text") {
      const texto = node.value ?? ""

      if (classes.length > 0 && texto.length > 0) {
        saida.push(Decoration.inline(posicao, posicao + texto.length, { class: classes.join(" ") }))
      }

      posicao += texto.length
      continue
    }

    const proprias = node.properties?.className ?? []
    posicao = collect(node.children ?? [], posicao, [...classes, ...proprias], saida)
  }

  return posicao
}

/** Decorações de um bloco. `from` é a posição do primeiro caractere do código. */
function decorateBlock(node: ProseNode, from: number): Decoration[] {
  const texto = node.textContent
  if (texto.trim() === "") return []

  const language = node.attrs.language as string | null

  try {
    const arvore = isSupported(language)
      ? lowlight.highlight(language, texto)
      : lowlight.highlightAuto(texto)

    const decoracoes: Decoration[] = []
    collect(arvore.children as HastNode[], from, [], decoracoes)

    return decoracoes
  } catch {
    // Linguagem desconhecida ou falha do realce: o código continua legível sem cor.
    return []
  }
}

function buildDecorations(doc: ProseNode): DecorationSet {
  const decoracoes: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.code_block) return true

    decoracoes.push(...decorateBlock(node, pos + 1))
    return false
  })

  return DecorationSet.create(doc, decoracoes)
}

/**
 * Realce de sintaxe por decorações: o documento continua sendo texto puro, então
 * o Markdown salvo não carrega nenhuma marcação de cor.
 */
export function syntaxHighlightPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: highlightKey,
    state: {
      init: (_config, state) => buildDecorations(state.doc),
      apply(tr, atual, _antigo, novo) {
        // Trocar a linguagem não muda o documento, mas muda as cores.
        if (!tr.docChanged && !tr.getMeta(highlightKey)) return atual.map(tr.mapping, tr.doc)

        return buildDecorations(novo.doc)
      },
    },
    props: {
      decorations: (state) => highlightKey.getState(state),
    },
  })
}

/** Marca a transação para o realce ser refeito mesmo sem mudança de texto. */
export function refreshHighlight(tr: Transaction): Transaction {
  return tr.setMeta(highlightKey, true)
}
