import { lift, setBlockType, toggleMark, wrapIn } from "prosemirror-commands"
import type { MarkType, Node as ProseNode, NodeType } from "prosemirror-model"
import { liftListItem, wrapInList } from "prosemirror-schema-list"
import type { Command, EditorState, Transaction } from "prosemirror-state"
import type { EditorView } from "prosemirror-view"

import { schema } from "@/components/ui/editor/schema"

type Dispatch = ((tr: Transaction) => void) | undefined

/** A marca está aplicada na seleção (ou vale para o próximo caractere digitado)? */
export function isMarkActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection

  if (empty) return Boolean(type.isInSet(state.storedMarks || $from.marks()))
  return state.doc.rangeHasMark(from, to, type)
}

/**
 * O bloco da seleção é deste tipo (e com estes atributos)? Só os atributos passados
 * são comparados — `hasMarkup` exigiria repetir todos os padrões do nó.
 */
export function isBlockActive(
  state: EditorState,
  type: NodeType,
  attrs: Record<string, unknown> = {}
): boolean {
  const { $from, to, node } = state.selection as EditorState["selection"] & {
    node?: ProseNode
  }

  const alvo = node ?? $from.parent
  if (!node && to > $from.end()) return false
  if (alvo.type !== type) return false

  return Object.entries(attrs).every(([chave, valor]) => alvo.attrs[chave] === valor)
}

/** A seleção está dentro de uma lista deste tipo? */
export function isListActive(state: EditorState, type: NodeType): boolean {
  const { $from } = state.selection

  for (let profundidade = $from.depth; profundidade > 0; profundidade--) {
    if ($from.node(profundidade).type === type) return true
  }

  return false
}

/** Alterna entre o parágrafo e o título do nível pedido. */
export function toggleHeading(level: number): Command {
  return (state, dispatch) => {
    const ativo = isBlockActive(state, schema.nodes.heading, { level })
    const comando = ativo
      ? setBlockType(schema.nodes.paragraph)
      : setBlockType(schema.nodes.heading, { level })

    return comando(state, dispatch)
  }
}

/** Alterna o bloco de código; fora dele, volta para parágrafo. */
export function toggleCodeBlock(): Command {
  return (state, dispatch) => {
    const ativo = isBlockActive(state, schema.nodes.code_block)
    const comando = ativo
      ? setBlockType(schema.nodes.paragraph)
      : setBlockType(schema.nodes.code_block)

    return comando(state, dispatch)
  }
}

/** Entra na citação ou sai dela, conforme o estado atual. */
export function toggleBlockquote(): Command {
  return (state, dispatch) => {
    if (isListActive(state, schema.nodes.blockquote) || estaDentro(state, schema.nodes.blockquote)) {
      return lift(state, dispatch)
    }

    return wrapIn(schema.nodes.blockquote)(state, dispatch)
  }
}

function estaDentro(state: EditorState, type: NodeType): boolean {
  const { $from } = state.selection

  for (let profundidade = $from.depth; profundidade > 0; profundidade--) {
    if ($from.node(profundidade).type === type) return true
  }

  return false
}

/**
 * Alterna uma lista. Dentro da mesma lista, desfaz; dentro de outra, troca o tipo
 * sem perder o conteúdo dos itens.
 */
export function toggleList(type: NodeType): Command {
  return (state, dispatch, view) => {
    if (isListActive(state, type)) {
      const item = type === schema.nodes.task_list ? schema.nodes.task_item : schema.nodes.list_item
      return liftListItem(item)(state, dispatch)
    }

    const outras = [schema.nodes.bullet_list, schema.nodes.ordered_list, schema.nodes.task_list]
    const atual = outras.find((candidata) => candidata !== type && isListActive(state, candidata))

    if (atual) return convertList(atual, type)(state, dispatch)

    return wrapInList(type)(state, dispatch, view)
  }
}

/**
 * Troca o tipo da lista reescrevendo o nó inteiro: os itens são recriados com o
 * tipo que a nova lista aceita, então o texto sobrevive à conversão.
 */
function convertList(from: NodeType, to: NodeType): Command {
  return (state, dispatch) => {
    const { $from } = state.selection

    let profundidade = -1
    for (let nivel = $from.depth; nivel > 0; nivel--) {
      if ($from.node(nivel).type === from) {
        profundidade = nivel
        break
      }
    }

    if (profundidade === -1) return false

    const lista = $from.node(profundidade)
    const inicio = $from.before(profundidade)
    const itemType = to === schema.nodes.task_list ? schema.nodes.task_item : schema.nodes.list_item

    const itens: ProseNode[] = []
    lista.forEach((item) => {
      itens.push(itemType.createChecked(null, item.content))
    })

    if (dispatch) {
      const nova = to.createChecked(null, itens)
      dispatch(state.tr.replaceWith(inicio, inicio + lista.nodeSize, nova).scrollIntoView())
    }

    return true
  }
}

export function toggleStrong(): Command {
  return toggleMark(schema.marks.strong)
}

export function toggleEm(): Command {
  return toggleMark(schema.marks.em)
}

export function toggleStrike(): Command {
  return toggleMark(schema.marks.strike)
}

export function toggleCode(): Command {
  return toggleMark(schema.marks.code)
}

/** Aplica o link na seleção; sem href, remove o que houver. */
export function setLink(href: string | null): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection
    if (empty) return false

    if (!href) {
      if (dispatch) dispatch(state.tr.removeMark(from, to, schema.marks.link))
      return true
    }

    if (dispatch) {
      dispatch(state.tr.addMark(from, to, schema.marks.link.create({ href })))
    }

    return true
  }
}

/** Insere a imagem na posição do cursor. */
export function insertImage(attrs: { src: string; alt?: string | null }): Command {
  return (state, dispatch) => {
    const node = schema.nodes.image.create({ src: attrs.src, alt: attrs.alt ?? null })
    if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
    return true
  }
}

/** Marca ou desmarca o item de tarefa que contém a posição. */
export function toggleTaskAt(view: EditorView, pos: number): boolean {
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.type !== schema.nodes.task_item) return false

  const tr = view.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    checked: !node.attrs.checked,
  })
  view.dispatch(tr)

  return true
}

/** Executa um comando na view e devevolve o foco ao editor. */
export function run(view: EditorView, command: Command): void {
  const dispatch: Dispatch = view.dispatch.bind(view)
  command(view.state, dispatch, view)
  view.focus()
}
