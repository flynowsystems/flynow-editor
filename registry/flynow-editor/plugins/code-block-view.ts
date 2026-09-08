import type { Node as ProseNode } from "prosemirror-model"
import type { EditorView, NodeView, ViewMutationRecord } from "prosemirror-view"

import { codeLanguages } from "@/components/ui/editor/lib/languages"

/**
 * Bloco de código com barra própria: escolher a linguagem, alternar a quebra de
 * linha e copiar o conteúdo. A barra fica fora do `contentDOM`, então nada dela
 * entra no documento — o Markdown continua sendo só a cerca com a linguagem.
 */
export class CodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private node: ProseNode
  private readonly view: EditorView
  private readonly getPos: () => number | undefined
  private readonly select: HTMLSelectElement

  constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement("div")
    this.dom.className = "flynow-editor-code"
    this.dom.setAttribute("data-wrap", "false")

    const barra = document.createElement("div")
    barra.className = "flynow-editor-code-toolbar"
    barra.contentEditable = "false"

    this.select = document.createElement("select")
    this.select.className = "flynow-editor-code-language"
    this.select.setAttribute("aria-label", "Linguagem do bloco de código")
    for (const { value, label } of codeLanguages) {
      const opcao = document.createElement("option")
      opcao.value = value ?? ""
      opcao.textContent = label
      this.select.appendChild(opcao)
    }
    this.select.value = node.attrs.language ?? ""
    this.select.addEventListener("change", () => this.setLanguage(this.select.value || null))

    barra.appendChild(this.select)
    barra.appendChild(this.button("Quebrar linhas", wrapIcon(), () => this.toggleWrap()))
    barra.appendChild(this.button("Copiar código", copyIcon(), (botao) => this.copy(botao)))

    const pre = document.createElement("pre")
    this.contentDOM = document.createElement("code")
    pre.appendChild(this.contentDOM)

    this.dom.appendChild(barra)
    this.dom.appendChild(pre)
  }

  /** Só o mesmo tipo de nó reaproveita esta view; o resto o ProseMirror recria. */
  update(node: ProseNode): boolean {
    if (node.type !== this.node.type) return false

    this.node = node
    this.select.value = node.attrs.language ?? ""

    return true
  }

  /** Cliques na barra não devem mexer na seleção do documento. */
  stopEvent(event: Event): boolean {
    return event.target instanceof HTMLElement && event.target.closest(".flynow-editor-code-toolbar") !== null
  }

  /**
   * Só as mutações da barra são ignoradas. Ignorar tudo faria o texto digitado
   * aparecer na tela sem nunca entrar no documento.
   */
  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return !this.contentDOM.contains(mutation.target)
  }

  private button(
    label: string,
    icone: SVGElement,
    onClick: (botao: HTMLButtonElement) => void
  ): HTMLButtonElement {
    const botao = document.createElement("button")
    botao.type = "button"
    botao.className = "flynow-editor-code-action"
    botao.title = label
    botao.setAttribute("aria-label", label)
    botao.appendChild(icone)
    botao.addEventListener("mousedown", (event) => event.preventDefault())
    botao.addEventListener("click", () => onClick(botao))

    return botao
  }

  private setLanguage(language: string | null): void {
    const pos = this.getPos()
    if (pos === undefined) return

    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, language })
    )
    this.view.focus()
  }

  private toggleWrap(): void {
    const ativo = this.dom.getAttribute("data-wrap") === "true"
    this.dom.setAttribute("data-wrap", String(!ativo))
  }

  private async copy(botao: HTMLButtonElement): Promise<void> {
    const texto = this.node.textContent

    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      const campo = document.createElement("textarea")
      campo.value = texto
      campo.style.position = "fixed"
      campo.style.opacity = "0"
      document.body.appendChild(campo)
      campo.select()
      document.execCommand("copy")
      campo.remove()
    }

    // Confirmação curta no próprio botão, sem depender de toast do host.
    botao.setAttribute("data-copied", "true")
    window.setTimeout(() => botao.removeAttribute("data-copied"), 1200)
  }
}

function svg(...paths: string[]): SVGElement {
  const elemento = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  elemento.setAttribute("viewBox", "0 0 24 24")
  elemento.setAttribute("fill", "none")
  elemento.setAttribute("stroke", "currentColor")
  elemento.setAttribute("stroke-width", "2")
  elemento.setAttribute("stroke-linecap", "round")
  elemento.setAttribute("stroke-linejoin", "round")

  for (const desenho of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", desenho)
    elemento.appendChild(path)
  }

  return elemento
}

function wrapIcon(): SVGElement {
  return svg("M3 6h18", "M3 12h13a3 3 0 0 1 0 6h-4", "M15 15l-3 3 3 3", "M3 18h4")
}

function copyIcon(): SVGElement {
  return svg(
    "M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z",
    "M5 15H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"
  )
}
