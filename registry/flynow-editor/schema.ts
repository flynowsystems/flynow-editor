import { Schema, type DOMOutputSpec, type NodeSpec, type MarkSpec } from "prosemirror-model"

/**
 * Blocos do documento. A ordem importa: o primeiro nó de cada grupo é o padrão
 * usado quando o ProseMirror precisa preencher um espaço vazio.
 */
const nodes: Record<string, NodeSpec> = {
  doc: { content: "block+" },

  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: (): DOMOutputSpec => ["p", 0],
  },

  heading: {
    attrs: { level: { default: 1 } },
    content: "inline*",
    group: "block",
    defining: true,
    parseDOM: [
      { tag: "h1", attrs: { level: 1 } },
      { tag: "h2", attrs: { level: 2 } },
      { tag: "h3", attrs: { level: 3 } },
    ],
    toDOM: (node): DOMOutputSpec => [`h${node.attrs.level}`, 0],
  },

  blockquote: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{ tag: "blockquote" }],
    toDOM: (): DOMOutputSpec => ["blockquote", 0],
  },

  code_block: {
    attrs: { language: { default: null } },
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full",
        getAttrs: (dom) => ({
          language: (dom as HTMLElement).getAttribute("data-language"),
        }),
      },
    ],
    toDOM: (node): DOMOutputSpec => [
      "pre",
      node.attrs.language ? { "data-language": node.attrs.language } : {},
      ["code", 0],
    ],
  },

  bullet_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM: (): DOMOutputSpec => ["ul", 0],
  },

  ordered_list: {
    attrs: { order: { default: 1 } },
    content: "list_item+",
    group: "block",
    parseDOM: [
      {
        tag: "ol",
        getAttrs: (dom) => ({
          order: Number((dom as HTMLElement).getAttribute("start")) || 1,
        }),
      },
    ],
    toDOM: (node): DOMOutputSpec =>
      node.attrs.order === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0],
  },

  list_item: {
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: "li" }],
    toDOM: (): DOMOutputSpec => ["li", 0],
  },

  task_list: {
    content: "task_item+",
    group: "block",
    parseDOM: [{ tag: "ul[data-type=task-list]" }],
    toDOM: (): DOMOutputSpec => ["ul", { "data-type": "task-list" }, 0],
  },

  /** O quadradinho é o próprio DOM do item; a marcação vive em `checked`. */
  task_item: {
    attrs: { checked: { default: false } },
    content: "paragraph block*",
    defining: true,
    parseDOM: [
      {
        tag: "li[data-type=task-item]",
        getAttrs: (dom) => ({
          checked: (dom as HTMLElement).getAttribute("data-checked") === "true",
        }),
      },
    ],
    toDOM: (node): DOMOutputSpec => [
      "li",
      { "data-type": "task-item", "data-checked": String(node.attrs.checked) },
      ["label", ["input", { type: "checkbox", ...(node.attrs.checked ? { checked: "" } : {}) }]],
      ["div", 0],
    ],
  },

  horizontal_rule: {
    group: "block",
    parseDOM: [{ tag: "hr" }],
    toDOM: (): DOMOutputSpec => ["hr"],
  },

  image: {
    inline: true,
    attrs: {
      src: {},
      alt: { default: null },
      title: { default: null },
    },
    group: "inline",
    draggable: true,
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs: (dom) => ({
          src: (dom as HTMLElement).getAttribute("src"),
          alt: (dom as HTMLElement).getAttribute("alt"),
          title: (dom as HTMLElement).getAttribute("title"),
        }),
      },
    ],
    toDOM: (node): DOMOutputSpec => ["img", node.attrs],
  },

  hard_break: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM: (): DOMOutputSpec => ["br"],
  },

  text: { group: "inline" },
}

/** Formatações inline. `code` exclui as demais para não gerar Markdown inválido. */
const marks: Record<string, MarkSpec> = {
  strong: {
    parseDOM: [
      { tag: "strong" },
      { tag: "b", getAttrs: (dom) => (dom as HTMLElement).style.fontWeight !== "normal" && null },
      { style: "font-weight=bold" },
      { style: "font-weight=700" },
    ],
    toDOM: (): DOMOutputSpec => ["strong", 0],
  },

  em: {
    parseDOM: [{ tag: "i" }, { tag: "em" }, { style: "font-style=italic" }],
    toDOM: (): DOMOutputSpec => ["em", 0],
  },

  strike: {
    parseDOM: [{ tag: "s" }, { tag: "del" }, { style: "text-decoration=line-through" }],
    toDOM: (): DOMOutputSpec => ["s", 0],
  },

  code: {
    excludes: "_",
    code: true,
    parseDOM: [{ tag: "code" }],
    toDOM: (): DOMOutputSpec => ["code", 0],
  },

  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (dom) => ({
          href: (dom as HTMLElement).getAttribute("href"),
          title: (dom as HTMLElement).getAttribute("title"),
        }),
      },
    ],
    toDOM: (mark): DOMOutputSpec => [
      "a",
      { ...mark.attrs, rel: "noopener noreferrer nofollow", target: "_blank" },
      0,
    ],
  },
}

/** Documento do editor. Trocar um nó aqui muda o que o Markdown aceita dos dois lados. */
export const schema = new Schema({ nodes, marks })
