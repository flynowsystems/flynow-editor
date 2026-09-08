# @flynow/editor

Editor de conteúdo da Fly Now. Markdown entra, Markdown sai; o motor é o
[ProseMirror](https://prosemirror.net) (MIT) e todo o resto — schema, comandos,
regras de digitação, serialização, barra e tema — é código nosso, editável no
projeto que instala, no estilo shadcn.

## Instalar

```bash
npx shadcn@latest add https://flynowsystems.github.io/flynow-editor/r/editor.json
```

O CLI instala as dependências e copia os arquivos para
`src/components/ui/editor/` do seu projeto. **O código passa a ser seu**: cor,
espaçamento, atalhos e comportamento se ajustam ali, sem esperar release nossa.

Depois, importe o tema uma vez — no `globals.css` (Tailwind v4) ou no layout raiz:

```css
@import "../components/ui/editor/editor.css";
```

Se o seu projeto não usa o alias `@/`, ajuste os imports no topo dos arquivos
copiados: eles se referenciam por `@/components/ui/editor/...`.

### Sem o CLI

Clonando o repositório, o mesmo conteúdo vai para um projeto com:

```bash
node scripts/sync.mjs ../caminho/do/projeto
```

O script lista as dependências a instalar ao final.

## Usar

```tsx
import { Editor } from "@/components/ui/editor/editor"

<Editor
  value={markdown}
  onChange={setMarkdown}
  onUpload={async (file) => ({ url: await enviar(file) })}
  onSubmit={salvar}
  placeholder="Escreva..."
/>
```

| Prop | O que faz |
|---|---|
| `value` | Conteúdo em Markdown. Mudanças externas substituem o documento. |
| `onChange` | Recebe o Markdown a cada edição. |
| `onUpload` | Recebe o arquivo colado, arrastado ou escolhido e devolve `{ url, alt? }`. Sem ela, o editor não intercepta imagens. |
| `onSubmit` | Ctrl/⌘+Enter — normalmente o "enviar" do formulário. |
| `onFocus` / `onBlur` | Eventos do campo. |
| `placeholder` | Texto de apoio no documento vazio. |
| `readOnly` | Renderiza sem edição — é assim que se exibe um comentário salvo. |
| `autoFocus` | Foca ao montar. |
| `toolbar` | `"floating"` (padrão), `"fixed"` ou `"none"`. |
| `ref` | `focus()`, `getMarkdown()`, `setMarkdown()`. |

## O que o editor entende

Títulos (`# `, `## `, `### `), listas (`- `, `1. `), lista de tarefas (`[ ] `),
citação (`> `), bloco de código (```` ``` ````), régua (`---`), **negrito**,
*itálico*, ~~riscado~~, `código`, links e imagens.

Atalhos: `Mod+B`, `Mod+I`, `Mod+E`, `Shift+Mod+X`, `Shift+Mod+1..3`,
`Shift+Mod+7/8/9` (listas), `Shift+Mod+B` (citação), `Shift+Mod+C` (código),
`Tab`/`Shift+Tab` em listas, `Shift+Enter` (quebra de linha), `Mod+Z` / `Shift+Mod+Z`.

## Tema

Tudo sai de variáveis em `editor.css`. Elas caem para os tokens do shadcn quando
existem, então o editor já nasce com a cara do app:

```css
.flynow-editor {
  --flynow-editor-fg: var(--foreground);
  --flynow-editor-muted: var(--muted-foreground);
  --flynow-editor-border: var(--border);
  --flynow-editor-radius: var(--radius);
}
```

## Requisitos

React 18 ou 19. Feito para **Next.js** (o componente já declara `"use client"`)
com back em **Laravel**, mas nada no editor depende de um ou de outro: `onUpload`
é um callback, então qualquer API serve.

## Desenvolvimento

```bash
npm install
npm test              # ida e volta do Markdown, regras de digitação e comandos
npm run typecheck
npm run build:registry  # gera docs/r/editor.json, o que o CLI do shadcn consome
```

Os testes rodam em Node puro: o documento e os comandos do ProseMirror não precisam
de navegador, então dá para exercitar digitação e formatação sem DOM.

## Estado

Feito: formatação, listas (inclusive de tarefas), código, links, imagens por colar,
arrastar ou botão, undo/redo, barra flutuante, tema e Markdown nos dois sentidos.

Fora da v1: menções `@`, comandos `/`, tabelas, realce de sintaxe no bloco de código
e edição colaborativa. O mapeamento completo está em [docs/MAPEAMENTO.md](docs/MAPEAMENTO.md).

## Publicação

`docs/r/editor.json` é servido pelo GitHub Pages (branch `main`, pasta `/docs`) e é
o que o CLI do shadcn lê. Depois de mexer em qualquer arquivo do editor, rode
`npm run build:registry` e faça commit do JSON gerado — o CI cobra isso.
