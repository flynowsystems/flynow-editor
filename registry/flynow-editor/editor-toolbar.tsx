"use client"

import { useEffect, useRef, useState } from "react"
import type { EditorView } from "prosemirror-view"

import {
  isBlockActive,
  isListActive,
  isMarkActive,
  run,
  setLink,
  toggleBlockquote,
  toggleCode,
  toggleCodeBlock,
  toggleEm,
  toggleHeading,
  toggleList,
  toggleStrike,
  toggleStrong,
} from "@/components/ui/editor/commands"
import { uploadImageFile, type UploadHandler } from "@/components/ui/editor/plugins/image-upload"
import { schema } from "@/components/ui/editor/schema"

type ToolbarButtonProps = {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, active, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-active={active || undefined}
      // O mousedown padrão tiraria a seleção do editor antes do clique chegar.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flynow-editor-toolbar-button"
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span aria-hidden className="flynow-editor-toolbar-divider" />
}

type EditorToolbarProps = {
  view: EditorView
  variant: "floating" | "fixed"
  onUpload?: UploadHandler
}

/**
 * Barra de ferramentas. Na variante flutuante ela só aparece com texto selecionado
 * e se posiciona acima da seleção, como no Linear.
 */
export function EditorToolbar({ view, variant, onUpload }: EditorToolbarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const { state } = view
  const flutuante = variant === "floating"
  const selecaoVazia = state.selection.empty

  useEffect(() => {
    if (!flutuante) return

    const barra = barRef.current
    if (!barra || selecaoVazia) {
      setPosition(null)
      return
    }

    const inicio = view.coordsAtPos(state.selection.from)
    const fim = view.coordsAtPos(state.selection.to)
    const referencia = barra.offsetParent as HTMLElement | null
    const caixa = referencia?.getBoundingClientRect()

    const meio = (Math.min(inicio.left, fim.left) + Math.max(inicio.right, fim.right)) / 2
    const topo = Math.min(inicio.top, fim.top)

    setPosition({
      top: topo - (caixa?.top ?? 0) - barra.offsetHeight - 8,
      left: Math.max(0, meio - (caixa?.left ?? 0) - barra.offsetWidth / 2),
    })
  }, [flutuante, selecaoVazia, state.selection.from, state.selection.to, view])

  if (flutuante && selecaoVazia) return null

  const acoes = (
    <>
      <ToolbarButton
        label="Título 1"
        active={isBlockActive(state, schema.nodes.heading, { level: 1 })}
        onClick={() => run(view, toggleHeading(1))}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        label="Título 2"
        active={isBlockActive(state, schema.nodes.heading, { level: 2 })}
        onClick={() => run(view, toggleHeading(2))}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Título 3"
        active={isBlockActive(state, schema.nodes.heading, { level: 3 })}
        onClick={() => run(view, toggleHeading(3))}
      >
        H3
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Negrito"
        active={isMarkActive(state, schema.marks.strong)}
        onClick={() => run(view, toggleStrong())}
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        label="Itálico"
        active={isMarkActive(state, schema.marks.em)}
        onClick={() => run(view, toggleEm())}
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        label="Riscado"
        active={isMarkActive(state, schema.marks.strike)}
        onClick={() => run(view, toggleStrike())}
      >
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton
        label="Código"
        active={isMarkActive(state, schema.marks.code)}
        onClick={() => run(view, toggleCode())}
      >
        <code>{"<>"}</code>
      </ToolbarButton>
      <ToolbarButton
        label="Link"
        active={isMarkActive(state, schema.marks.link)}
        onClick={() => {
          const atual = isMarkActive(state, schema.marks.link)
          if (atual) {
            run(view, setLink(null))
            return
          }

          const href = window.prompt("Endereço do link")
          if (href) run(view, setLink(href))
        }}
      >
        🔗
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Lista"
        active={isListActive(state, schema.nodes.bullet_list)}
        onClick={() => run(view, toggleList(schema.nodes.bullet_list))}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={isListActive(state, schema.nodes.ordered_list)}
        onClick={() => run(view, toggleList(schema.nodes.ordered_list))}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        label="Lista de tarefas"
        active={isListActive(state, schema.nodes.task_list)}
        onClick={() => run(view, toggleList(schema.nodes.task_list))}
      >
        ☑
      </ToolbarButton>
      <ToolbarButton
        label="Citação"
        active={isBlockActive(state, schema.nodes.blockquote)}
        onClick={() => run(view, toggleBlockquote())}
      >
        ❝
      </ToolbarButton>
      <ToolbarButton
        label="Bloco de código"
        active={isBlockActive(state, schema.nodes.code_block)}
        onClick={() => run(view, toggleCodeBlock())}
      >
        {"{ }"}
      </ToolbarButton>

      {onUpload ? (
        <>
          <Divider />
          <ToolbarButton label="Imagem" onClick={() => fileRef.current?.click()}>
            🖼
          </ToolbarButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) uploadImageFile(view, file, onUpload)
              event.target.value = ""
            }}
          />
        </>
      ) : null}
    </>
  )

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Formatação"
      data-variant={variant}
      className="flynow-editor-toolbar"
      style={
        flutuante
          ? { top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }
          : undefined
      }
    >
      {acoes}
    </div>
  )
}
