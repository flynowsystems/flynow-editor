import type { Node as ProseNode } from "prosemirror-model"
import type { EditorView, NodeView, ViewMutationRecord } from "prosemirror-view"

import {
  codeLanguages,
  isSupported,
  languageLabel,
  lowlight,
} from "@/components/ui/editor/lib/languages"
import { refreshHighlight } from "@/components/ui/editor/plugins/syntax-highlight"

/**
 * Bloco de código com barra própria: linguagem, quebra de linha e copiar. A barra
 * fica fora do `contentDOM`, então nada dela entra no documento — o Markdown
 * continua sendo só a cerca com a linguagem.
 */
export class CodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private node: ProseNode
  private readonly view: EditorView
  private readonly getPos: () => number | undefined

  private readonly languageButton: HTMLButtonElement
  private readonly languageText: HTMLSpanElement
  private readonly menu: HTMLDivElement
  private readonly aoClicarFora: (event: MouseEvent) => void

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

    this.languageText = document.createElement("span")
    this.languageButton = document.createElement("button")
    this.languageButton.type = "button"
    this.languageButton.className = "flynow-editor-code-language"
    this.languageButton.setAttribute("aria-label", "Linguagem do bloco de código")
    this.languageButton.setAttribute("aria-haspopup", "listbox")
    this.languageButton.appendChild(this.languageText)
    this.languageButton.appendChild(chevronIcon())
    this.languageButton.addEventListener("mousedown", (event) => event.preventDefault())
    this.languageButton.addEventListener("click", () => this.toggleMenu())

    this.menu = document.createElement("div")
    this.menu.className = "flynow-editor-code-menu"
    this.menu.setAttribute("role", "listbox")
    this.menu.hidden = true
    for (const { value, label } of codeLanguages) {
      this.menu.appendChild(this.menuItem(value, label))
    }

    barra.appendChild(this.languageButton)
    barra.appendChild(this.button("Quebrar linhas", wrapIcon(), () => this.toggleWrap()))
    barra.appendChild(this.button("Copiar código", copyIcon(), (botao) => this.copy(botao)))

    const pre = document.createElement("pre")
    this.contentDOM = document.createElement("code")
    pre.appendChild(this.contentDOM)

    this.dom.appendChild(barra)
    this.dom.appendChild(this.menu)
    this.dom.appendChild(pre)
    this.renderLanguage()

    // Um clique em qualquer outro lugar fecha o menu, como em qualquer dropdown.
    this.aoClicarFora = (event) => {
      if (!this.menu.hidden && !this.dom.contains(event.target as Node)) this.closeMenu()
    }
    document.addEventListener("mousedown", this.aoClicarFora)
  }

  update(node: ProseNode): boolean {
    if (node.type !== this.node.type) return false

    this.node = node
    this.renderLanguage()

    return true
  }

  /** Cliques na barra e no menu não devem mexer na seleção do documento. */
  stopEvent(event: Event): boolean {
    const alvo = event.target
    if (!(alvo instanceof HTMLElement)) return false

    return alvo.closest(".flynow-editor-code-toolbar, .flynow-editor-code-menu") !== null
  }

  /**
   * Só as mutações da barra são ignoradas. Ignorar tudo faria o texto digitado
   * aparecer na tela sem nunca entrar no documento.
   */
  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return !this.contentDOM.contains(mutation.target)
  }

  destroy(): void {
    document.removeEventListener("mousedown", this.aoClicarFora)
  }

  /** No modo automático o rótulo mostra a linguagem que o realce reconheceu. */
  private renderLanguage(): void {
    const language = this.node.attrs.language as string | null
    const detectada = language === null ? this.detect() : null

    this.languageText.textContent = detectada
      ? `${languageLabel(detectada)} (auto)`
      : languageLabel(language)

    for (const item of this.menu.querySelectorAll<HTMLElement>("[data-value]")) {
      const valor = item.dataset.value === "" ? null : item.dataset.value
      item.setAttribute("aria-selected", String(valor === language))
    }
  }

  private detect(): string | null {
    const texto = this.node.textContent
    if (texto.trim() === "") return null

    try {
      return lowlight.highlightAuto(texto).data?.language ?? null
    } catch {
      return null
    }
  }

  private menuItem(value: string | null, label: string): HTMLButtonElement {
    const item = document.createElement("button")
    item.type = "button"
    item.className = "flynow-editor-code-menu-item"
    item.dataset.value = value ?? ""
    item.setAttribute("role", "option")
    item.textContent = label
    item.addEventListener("mousedown", (event) => event.preventDefault())
    item.addEventListener("click", () => {
      this.setLanguage(value)
      this.closeMenu()
    })

    return item
  }

  private toggleMenu(): void {
    if (this.menu.hidden) {
      this.menu.hidden = false
      this.menu
        .querySelector<HTMLElement>('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" })
      return
    }

    this.closeMenu()
  }

  private closeMenu(): void {
    this.menu.hidden = true
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

    const valido = language === null || isSupported(language) ? language : null
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      language: valido,
    })

    this.view.dispatch(refreshHighlight(tr))
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

function chevronIcon(): SVGElement {
  return svg("M6 9l6 6 6-6")
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
