import { Plugin, PluginKey } from "prosemirror-state"
import { Decoration, DecorationSet } from "prosemirror-view"
import type { EditorView } from "prosemirror-view"

import { schema } from "@/components/ui/editor/schema"

/** O que o host devolve depois de guardar o arquivo. */
export type UploadedImage = { url: string; alt?: string | null }

export type UploadHandler = (file: File) => Promise<UploadedImage>

type UploadMeta =
  | { type: "start"; id: symbol; pos: number; name: string }
  | { type: "finish"; id: symbol }

const uploadKey = new PluginKey<DecorationSet>("flynow-editor-upload")

/**
 * Enquanto o arquivo sobe, um marcador ocupa o lugar da imagem. Ele é uma decoração,
 * então a digitação continua livre e a posição acompanha as edições feitas no meio-tempo.
 */
function uploadPlaceholderPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: uploadKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, conjunto) {
        let atual = conjunto.map(tr.mapping, tr.doc)
        const meta = tr.getMeta(uploadKey) as UploadMeta | undefined

        if (meta?.type === "start") {
          const marcador = document.createElement("span")
          marcador.className = "flynow-editor-uploading"
          marcador.textContent = `Enviando ${meta.name}...`

          atual = atual.add(tr.doc, [Decoration.widget(meta.pos, marcador, { id: meta.id })])
        }

        if (meta?.type === "finish") {
          atual = atual.remove(atual.find(undefined, undefined, (spec) => spec.id === meta.id))
        }

        return atual
      },
    },
    props: {
      decorations: (state) => uploadKey.getState(state),
    },
  })
}

/** Onde o marcador está agora — ele se move se o texto ao redor mudar. */
function findPlaceholder(view: EditorView, id: symbol): number | null {
  const conjunto = uploadKey.getState(view.state)
  const encontrado = conjunto?.find(undefined, undefined, (spec) => spec.id === id)

  return encontrado?.length ? encontrado[0].from : null
}

async function upload(view: EditorView, file: File, pos: number, handler: UploadHandler) {
  const id = Symbol(file.name)

  view.dispatch(view.state.tr.setMeta(uploadKey, { type: "start", id, pos, name: file.name }))

  try {
    const { url, alt } = await handler(file)
    const destino = findPlaceholder(view, id)

    const tr = view.state.tr.setMeta(uploadKey, { type: "finish", id })
    if (destino !== null) {
      tr.replaceWith(destino, destino, schema.nodes.image.create({ src: url, alt: alt ?? file.name }))
    }

    view.dispatch(tr)
  } catch {
    // Falhou: só o marcador sai, o texto que a pessoa escreveu no meio-tempo fica.
    view.dispatch(view.state.tr.setMeta(uploadKey, { type: "finish", id }))
  }
}

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith("image/"))
}

/**
 * Colar e arrastar imagens. Sem `handler` o plugin não intercepta nada — o editor
 * segue funcionando como texto puro em quem não tem onde guardar arquivo.
 */
export function imageUploadPlugin(handler?: UploadHandler): Plugin[] {
  if (!handler) return []

  const eventos = new Plugin({
    props: {
      handlePaste(view, event) {
        const arquivos = imageFiles(event.clipboardData?.files)
        if (arquivos.length === 0) return false

        event.preventDefault()
        const pos = view.state.selection.from
        arquivos.forEach((file) => void upload(view, file, pos, handler))

        return true
      },

      handleDrop(view, event) {
        const arquivos = imageFiles((event as DragEvent).dataTransfer?.files)
        if (arquivos.length === 0) return false

        event.preventDefault()
        const coordenadas = view.posAtCoords({
          left: (event as DragEvent).clientX,
          top: (event as DragEvent).clientY,
        })
        const pos = coordenadas?.pos ?? view.state.selection.from
        arquivos.forEach((file) => void upload(view, file, pos, handler))

        return true
      },
    },
  })

  return [uploadPlaceholderPlugin(), eventos]
}

/** Sobe um arquivo escolhido pelo botão da barra, na posição do cursor. */
export function uploadImageFile(view: EditorView, file: File, handler: UploadHandler): void {
  void upload(view, file, view.state.selection.from, handler)
}
