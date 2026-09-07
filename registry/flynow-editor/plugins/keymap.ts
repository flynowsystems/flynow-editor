import {
  baseKeymap,
  chainCommands,
  createParagraphNear,
  exitCode,
  liftEmptyBlock,
  newlineInCode,
  splitBlock,
  toggleMark,
} from "prosemirror-commands"
import { redo, undo } from "prosemirror-history"
import { keymap } from "prosemirror-keymap"
import { liftListItem, sinkListItem, splitListItem } from "prosemirror-schema-list"
import type { Command, Plugin } from "prosemirror-state"

import {
  toggleBlockquote,
  toggleCodeBlock,
  toggleHeading,
  toggleList,
} from "@/components/ui/editor/commands"
import { schema } from "@/components/ui/editor/schema"

/** No Mac o modificador é ⌘; no resto, Ctrl. */
const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform)

type EditorKeymapOptions = {
  /** Chamado por Ctrl/⌘+Enter — costuma ser o "enviar" do formulário que hospeda o editor. */
  onSubmit?: () => void
}

/**
 * Enter dentro de lista divide o item; dentro de bloco de código, quebra a linha.
 * A ordem da cadeia é a prioridade: o primeiro comando que trata a tecla vence.
 */
const enterCommand: Command = chainCommands(
  splitListItem(schema.nodes.task_item),
  splitListItem(schema.nodes.list_item),
  newlineInCode,
  createParagraphNear,
  liftEmptyBlock,
  splitBlock
)

export function buildKeymap({ onSubmit }: EditorKeymapOptions = {}): Plugin[] {
  const atalhos: Record<string, Command> = {
    "Mod-z": undo,
    "Shift-Mod-z": redo,
    "Mod-y": redo,

    "Mod-b": toggleMark(schema.marks.strong),
    "Mod-i": toggleMark(schema.marks.em),
    "Mod-e": toggleMark(schema.marks.code),
    "Shift-Mod-x": toggleMark(schema.marks.strike),

    "Shift-Mod-1": toggleHeading(1),
    "Shift-Mod-2": toggleHeading(2),
    "Shift-Mod-3": toggleHeading(3),
    "Shift-Mod-8": toggleList(schema.nodes.bullet_list),
    "Shift-Mod-9": toggleList(schema.nodes.ordered_list),
    "Shift-Mod-7": toggleList(schema.nodes.task_list),
    "Shift-Mod-b": toggleBlockquote(),
    "Shift-Mod-c": toggleCodeBlock(),

    Enter: enterCommand,
    Tab: chainCommands(sinkListItem(schema.nodes.task_item), sinkListItem(schema.nodes.list_item)),
    "Shift-Tab": chainCommands(
      liftListItem(schema.nodes.task_item),
      liftListItem(schema.nodes.list_item)
    ),

    // Quebra de linha sem sair do parágrafo, e saída do bloco de código.
    "Shift-Enter": chainCommands(exitCode, (state, dispatch) => {
      if (dispatch) {
        dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView())
      }
      return true
    }),
  }

  if (onSubmit) {
    atalhos["Mod-Enter"] = () => {
      onSubmit()
      return true
    }
  }

  if (isMac) atalhos["Ctrl-Enter"] = atalhos["Mod-Enter"] ?? (() => false)

  return [keymap(atalhos), keymap(baseKeymap)]
}
