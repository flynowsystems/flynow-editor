import { keymap } from "prosemirror-keymap"
import type { Command, EditorState, Plugin } from "prosemirror-state"
import { TextSelection } from "prosemirror-state"

import { schema } from "@/components/ui/editor/schema"

/** Um nível de recuo. Dois espaços é o padrão do Prettier e do próprio Linear. */
const INDENT = "  "

type Contexto = { from: number; texto: string; offset: number }

/** Texto do bloco de código onde está o cursor, ou nada se a seleção está fora. */
function contexto(state: EditorState): Contexto | null {
  const { $from, empty } = state.selection
  if (!empty || $from.parent.type !== schema.nodes.code_block) return null

  return { from: $from.start(), texto: $from.parent.textContent, offset: $from.parentOffset }
}

/** Recuo da linha onde o cursor está. */
function currentIndent({ texto, offset }: Contexto): string {
  const inicioDaLinha = texto.lastIndexOf("\n", offset - 1) + 1
  const linha = texto.slice(inicioDaLinha, offset)

  return linha.match(/^[ \t]*/)?.[0] ?? ""
}

/** A linha anterior abre um bloco? Aí a próxima entra um nível. */
function opensBlock({ texto, offset }: Contexto): boolean {
  const inicioDaLinha = texto.lastIndexOf("\n", offset - 1) + 1
  const linha = texto.slice(inicioDaLinha, offset).trimEnd()

  return /[{[(:]$/.test(linha)
}

/**
 * Enter dentro do bloco repete o recuo da linha e entra mais um nível depois de
 * `{`, `[`, `(` ou `:` — o que se espera de qualquer editor de código.
 */
export const newlineWithIndent: Command = (state, dispatch) => {
  const atual = contexto(state)
  if (!atual) return false

  const recuo = currentIndent(atual) + (opensBlock(atual) ? INDENT : "")
  if (dispatch) {
    dispatch(state.tr.insertText(`\n${recuo}`).scrollIntoView())
  }

  return true
}

/** Tab dentro do bloco recua a linha em vez de sair do editor. */
export const indentCode: Command = (state, dispatch) => {
  const atual = contexto(state)
  if (!atual) return false

  if (dispatch) dispatch(state.tr.insertText(INDENT).scrollIntoView())
  return true
}

/** Shift+Tab tira um nível de recuo da linha atual. */
export const outdentCode: Command = (state, dispatch) => {
  const atual = contexto(state)
  if (!atual) return false

  const inicioDaLinha = atual.texto.lastIndexOf("\n", atual.offset - 1) + 1
  const linha = atual.texto.slice(inicioDaLinha)
  const recuo = linha.match(/^[ \t]*/)?.[0] ?? ""
  if (recuo === "") return true

  const remover = recuo.startsWith(INDENT) ? INDENT.length : 1
  const posicao = atual.from + inicioDaLinha

  if (dispatch) dispatch(state.tr.delete(posicao, posicao + remover).scrollIntoView())
  return true
}

/**
 * Backspace no recuo apaga o nível inteiro, não um espaço de cada vez. Fora do
 * recuo o comando não trata a tecla e o apagar normal segue.
 */
export const backspaceIndent: Command = (state, dispatch) => {
  const atual = contexto(state)
  if (!atual) return false

  const inicioDaLinha = atual.texto.lastIndexOf("\n", atual.offset - 1) + 1
  const antes = atual.texto.slice(inicioDaLinha, atual.offset)
  if (antes === "" || antes.trim() !== "") return false

  const remover = antes.endsWith(INDENT) ? INDENT.length : 1
  const posicao = atual.from + atual.offset

  if (dispatch) dispatch(state.tr.delete(posicao - remover, posicao).scrollIntoView())
  return true
}

/**
 * Ao digitar `}`, `]` ou `)` sozinho na linha, o recuo volta um nível — o
 * fechamento se alinha com a abertura sem ninguém apagar espaço na mão.
 */
export const closeBlockIndent: Command = (state, dispatch) => {
  const atual = contexto(state)
  if (!atual) return false

  const inicioDaLinha = atual.texto.lastIndexOf("\n", atual.offset - 1) + 1
  const antes = atual.texto.slice(inicioDaLinha, atual.offset)
  if (antes.trim() !== "" || !antes.startsWith(INDENT)) return false

  const posicao = atual.from + inicioDaLinha
  if (dispatch) {
    const tr = state.tr.delete(posicao, posicao + INDENT.length)
    const destino = tr.selection.from
    dispatch(tr.setSelection(TextSelection.create(tr.doc, destino)).scrollIntoView())
  }

  return true
}

/** Digitar o fechamento também realinha a linha. */
function closerRule(caractere: string): Command {
  return (state, dispatch, view) => {
    const tratado = closeBlockIndent(state, dispatch, view)
    if (!tratado) return false

    // O recuo saiu; agora o próprio caractere entra na posição corrigida.
    const atualizado = view?.state ?? state
    if (dispatch) dispatch(atualizado.tr.insertText(caractere).scrollIntoView())

    return true
  }
}

/**
 * Teclas do bloco de código. Precisa vir antes do keymap geral: `Tab` lá dentro
 * significa recuo, não pular para o próximo item de lista.
 */
export function buildCodeKeymap(): Plugin {
  return keymap({
    Enter: newlineWithIndent,
    Tab: indentCode,
    "Shift-Tab": outdentCode,
    Backspace: backspaceIndent,
    "}": closerRule("}"),
    "]": closerRule("]"),
    ")": closerRule(")"),
  })
}

/** Exportado para os testes: o recuo aplicado por Enter em um dado contexto. */
export function indentFor(state: EditorState): string | null {
  const atual = contexto(state)
  if (!atual) return null

  return currentIndent(atual) + (opensBlock(atual) ? INDENT : "")
}

export { INDENT }
