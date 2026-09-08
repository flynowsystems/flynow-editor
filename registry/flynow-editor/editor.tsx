"use client"

import { useEffect, useImperativeHandle, useRef, useState } from "react"
import { dropCursor } from "prosemirror-dropcursor"
import { gapCursor } from "prosemirror-gapcursor"
import { history } from "prosemirror-history"
import { EditorState } from "prosemirror-state"
import { EditorView } from "prosemirror-view"

import { EditorToolbar } from "@/components/ui/editor/editor-toolbar"
import { toggleTaskAt } from "@/components/ui/editor/commands"
import { fromMarkdown, toMarkdown } from "@/components/ui/editor/lib/markdown"
import { CodeBlockView } from "@/components/ui/editor/plugins/code-block-view"
import { buildCodeKeymap } from "@/components/ui/editor/plugins/code-indent"
import { buildInputRules } from "@/components/ui/editor/plugins/input-rules"
import { buildKeymap } from "@/components/ui/editor/plugins/keymap"
import { imageUploadPlugin, type UploadHandler } from "@/components/ui/editor/plugins/image-upload"
import { placeholderPlugin } from "@/components/ui/editor/plugins/placeholder"
import { syntaxHighlightPlugin } from "@/components/ui/editor/plugins/syntax-highlight"
import { schema } from "@/components/ui/editor/schema"

export type EditorHandle = {
  /** Foca o editor e leva o cursor para o fim do documento. */
  focus: () => void
  /** Markdown atual, sem esperar o `onChange`. */
  getMarkdown: () => string
  /** Troca o conteúdo — use para limpar o campo depois de enviar. */
  setMarkdown: (markdown: string) => void
}

export type EditorProps = {
  /** Conteúdo em Markdown. Mudanças externas substituem o documento. */
  value: string
  onChange?: (markdown: string) => void
  /** Recebe o arquivo colado, arrastado ou escolhido e devolve a URL pública. */
  onUpload?: UploadHandler
  /** Disparado por Ctrl/⌘+Enter. */
  onSubmit?: () => void
  onFocus?: () => void
  onBlur?: () => void
  placeholder?: string
  readOnly?: boolean
  autoFocus?: boolean
  /** Barra flutuante sobre a seleção, barra fixa no topo ou nenhuma. */
  toolbar?: "floating" | "fixed" | "none"
  className?: string
  ref?: React.Ref<EditorHandle>
}

/**
 * Editor de conteúdo em Markdown. O estado real vive no ProseMirror; o React só
 * hospeda o nó e observa a seleção para desenhar a barra de ferramentas.
 */
export function Editor({
  value,
  onChange,
  onUpload,
  onSubmit,
  onFocus,
  onBlur,
  placeholder = "Escreva alguma coisa...",
  readOnly = false,
  autoFocus = false,
  toolbar = "floating",
  className,
  ref,
}: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  /** Último Markdown que saiu daqui: evita reconstruir o documento no próprio eco. */
  const lastMarkdown = useRef(value)
  const callbacks = useRef({ onChange, onSubmit, onUpload, onFocus, onBlur })
  const [view, setView] = useState<EditorView | null>(null)
  const [, forceRender] = useState(0)

  // As callbacks vivem em ref para que a view não seja recriada (e o histórico perdido)
  // a cada render do host; a escrita acontece depois da renderização.
  useEffect(() => {
    callbacks.current = { onChange, onSubmit, onUpload, onFocus, onBlur }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const state = EditorState.create({
      doc: fromMarkdown(lastMarkdown.current),
      plugins: [
        buildInputRules(),
        buildCodeKeymap(),
        ...buildKeymap({ onSubmit: () => callbacks.current.onSubmit?.() }),
        ...imageUploadPlugin(callbacks.current.onUpload),
        history(),
        dropCursor({ color: "var(--flynow-editor-caret, currentColor)" }),
        gapCursor(),
        placeholderPlugin(placeholder),
        syntaxHighlightPlugin(),
      ],
    })

    const instance = new EditorView(host, {
      state,
      editable: () => !readOnly,
      attributes: { class: "flynow-editor-content", spellcheck: "true" },
      nodeViews: {
        code_block: (node, nodeView, getPos) => new CodeBlockView(node, nodeView, getPos),
      },
      dispatchTransaction(transaction) {
        const proximo = instance.state.apply(transaction)
        instance.updateState(proximo)

        if (transaction.docChanged) {
          const markdown = toMarkdown(proximo.doc)
          lastMarkdown.current = markdown
          callbacks.current.onChange?.(markdown)
        }

        // A barra depende da seleção, então acompanha qualquer transação.
        forceRender((contador) => contador + 1)
      },
      handleClickOn(clickView, _pos, node, nodePos, event) {
        // Clique no quadradinho da tarefa alterna a marcação sem mover o cursor.
        const alvo = event.target as HTMLElement
        if (node.type !== schema.nodes.task_item || alvo.tagName !== "INPUT") return false

        return toggleTaskAt(clickView, nodePos)
      },
    })

    // focus/blur ficam no DOM: o `handleDOMEvents` da view não recebe estes dois.
    const aoFocar = () => callbacks.current.onFocus?.()
    const aoSair = () => callbacks.current.onBlur?.()
    instance.dom.addEventListener("focus", aoFocar)
    instance.dom.addEventListener("blur", aoSair)

    viewRef.current = instance
    setView(instance)
    if (autoFocus) instance.focus()

    return () => {
      instance.dom.removeEventListener("focus", aoFocar)
      instance.dom.removeEventListener("blur", aoSair)
      instance.destroy()
      viewRef.current = null
      setView(null)
    }
    // Recriar a view a cada mudança de callback perderia o histórico; elas vivem no ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Conteúdo vindo de fora (carregou da API, outro usuário salvou) substitui o documento.
  useEffect(() => {
    const instance = viewRef.current
    if (!instance || value === lastMarkdown.current) return

    lastMarkdown.current = value
    const doc = fromMarkdown(value)
    const state = EditorState.create({ doc, plugins: instance.state.plugins })
    instance.updateState(state)
  }, [value])

  useEffect(() => {
    viewRef.current?.setProps({ editable: () => !readOnly })
  }, [readOnly])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const instance = viewRef.current
        if (!instance) return
        instance.focus()
      },
      getMarkdown: () => (viewRef.current ? toMarkdown(viewRef.current.state.doc) : ""),
      setMarkdown: (markdown: string) => {
        const instance = viewRef.current
        if (!instance) return

        lastMarkdown.current = markdown
        instance.updateState(
          EditorState.create({ doc: fromMarkdown(markdown), plugins: instance.state.plugins })
        )
      },
    }),
    []
  )

  return (
    <div className={["flynow-editor", className].filter(Boolean).join(" ")}>
      {view && toolbar !== "none" && !readOnly ? (
        <EditorToolbar view={view} variant={toolbar} onUpload={onUpload} />
      ) : null}
      <div ref={hostRef} />
    </div>
  )
}
