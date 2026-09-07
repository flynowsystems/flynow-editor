import { EditorState } from "prosemirror-state"
import { fromMarkdown, toMarkdown } from "@/components/ui/editor/lib/markdown"
import { buildInputRules } from "@/components/ui/editor/plugins/input-rules"

const rules = buildInputRules()

function type(inicial: string, texto: string) {
  const state = EditorState.create({ doc: fromMarkdown(inicial), plugins: [rules] })
  const view = { state, dispatch(tr: never) { view.state = view.state.apply(tr) } }
  // cursor no fim
  view.state = view.state.apply(view.state.tr.setSelection((view.state.selection.constructor as never as { atEnd: (d: unknown) => never }).atEnd(view.state.doc)))

  for (const c of texto) {
    const { from, to } = view.state.selection
    const ok = rules.props.handleTextInput?.call(rules, view as never, from, to, c, (() => null) as never)
    if (!ok) view.dispatch(view.state.tr.insertText(c, from, to) as never)
  }
  return toMarkdown(view.state.doc).trim()
}

console.log(JSON.stringify(type("fdfdf", " com **negrito**")))
console.log(JSON.stringify(type("", "peso **forte**")))
console.log(JSON.stringify(type("fdfdf", " e `cod`")))
