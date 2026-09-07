import { Plugin } from "prosemirror-state"
import { Decoration, DecorationSet } from "prosemirror-view"

/**
 * Texto de apoio no documento vazio. É uma decoração — nada entra no documento,
 * então o Markdown salvo continua vazio.
 */
export function placeholderPlugin(text: string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const doc = state.doc
        const vazio =
          doc.childCount === 1 && doc.firstChild?.isTextblock && doc.firstChild.content.size === 0

        if (!vazio) return null

        const decoracao = Decoration.node(0, doc.firstChild!.nodeSize, {
          class: "flynow-editor-placeholder",
          "data-placeholder": text,
        })

        return DecorationSet.create(doc, [decoracao])
      },
    },
  })
}
