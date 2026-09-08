import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules"
import type { MarkType } from "prosemirror-model"
import type { Plugin } from "prosemirror-state"

import { schema } from "@/components/ui/editor/schema"

/**
 * Regra de marca: ao fechar a marcação (`**forte**`), o texto entre os delimitadores
 * recebe a marca e os delimitadores somem — como no Linear e no Notion.
 */
function markRule(pattern: RegExp, type: MarkType): InputRule {
  return new InputRule(pattern, (state, match, start, end) => {
    const conteudo = match[1]
    if (!conteudo) return null

    const tr = state.tr
    const inicioTexto = start + match[0].indexOf(conteudo)
    const fimTexto = inicioTexto + conteudo.length

    // De trás para frente: apagar o fim primeiro mantém as posições do início válidas.
    if (fimTexto < end) tr.delete(fimTexto, end)
    if (inicioTexto > start) tr.delete(start, inicioTexto)

    return tr.addMark(start, start + conteudo.length, type.create()).removeStoredMark(type)
  })
}

/** Regras de digitação: Markdown vira formatação enquanto se escreve. */
export function buildInputRules(): Plugin {
  return inputRules({
    rules: [
      // Blocos
      textblockTypeInputRule(/^(#{1,3})\s$/, schema.nodes.heading, (match) => ({
        level: match[1].length,
      })),
      textblockTypeInputRule(/^```([a-zA-Z0-9+#-]*)$/, schema.nodes.code_block, (match) => ({
        language: match[1] || null,
      })),
      wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
      wrappingInputRule(/^\s*[-+*]\s$/, schema.nodes.bullet_list),
      wrappingInputRule(
        /^(\d+)\.\s$/,
        schema.nodes.ordered_list,
        (match) => ({ order: Number(match[1]) }),
        (match, node) => node.childCount + node.attrs.order === Number(match[1])
      ),
      // "[ ] " no começo da linha abre uma lista de tarefas; o item nasce desmarcado.
      wrappingInputRule(/^\s*\[([ xX])\]\s$/, schema.nodes.task_list),
      new InputRule(/^(?:---|___|\*\*\*)\s$/, (state, _match, start, end) =>
        state.tr.replaceRangeWith(start, end, schema.nodes.horizontal_rule.create())
      ),

      // Marcas
      // O lookbehind evita capturar o caractere anterior: sem ele, o espaço antes
      // do delimitador entraria no trecho apagado.
      markRule(/(?<!\*)\*\*([^*]+)\*\*$/, schema.marks.strong),
      markRule(/(?<!_)__([^_]+)__$/, schema.marks.strong),
      markRule(/(?<![*\w])\*([^*]+)\*$/, schema.marks.em),
      markRule(/(?<![_\w])_([^_]+)_$/, schema.marks.em),
      markRule(/~~([^~]+)~~$/, schema.marks.strike),
      markRule(/`([^`]+)`$/, schema.marks.code),
    ],
  })
}
