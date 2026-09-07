# Editor Fly Now — mapeamento

Editor de conteúdo reutilizável entre os projetos da casa. Front sempre **Next.js**,
back sempre **Laravel**.

## Decisões

| Decisão | Por quê |
|---|---|
| ProseMirror puro (sem TipTap) | O motor resolve IME/acentuação, seleção, undo e colagem — a parte que quebra em editor caseiro. Sem camada comercial: tudo que é nosso (schema, comandos, UI, Markdown) fica em código aberto no projeto. |
| Markdown como formato | É o que a API do TicketFlow já guarda (`description`, `body` de comentário). Texto puro no banco, sem JSON opaco, e legível fora do app. |
| Distribuição estilo shadcn | O código vai para `src/components/ui/editor/` do projeto consumidor e pode ser editado. Sem pacote fechado: cor, espaçamento e comportamento são alterados no próprio repositório que usa. |
| Tema por variáveis CSS | `--flynow-editor-*` cai para os tokens do shadcn (`--foreground`, `--border`, `--primary`) quando existem. Um projeto sem shadcn continua funcionando com os valores de fallback. |

## Arquivos

```
components/ui/editor/
  editor.tsx              componente React: hospeda a EditorView e expõe value/onChange
  editor-toolbar.tsx      barra flutuante (ou fixa) com o estado dos comandos
  editor.css              tema — variáveis, tipografia do conteúdo, barra
  schema.ts               nós e marcas do documento
  commands.ts             comandos e verificações de estado (ativo/inativo)
  lib/markdown.ts         Markdown ⇄ documento (parser e serializador)
  plugins/
    input-rules.ts        "# ", "- ", "```", "**forte**" enquanto se digita
    keymap.ts             atalhos, Enter em listas, Shift+Enter, Ctrl/⌘+Enter
    placeholder.ts        texto de apoio no documento vazio
    image-upload.ts       colar/arrastar imagem → callback do host
```

## Contrato do componente

```tsx
<Editor
  value={markdown}
  onChange={setMarkdown}
  onUpload={async (file) => ({ url: await enviar(file) })}
  onSubmit={salvar}            // Ctrl/⌘+Enter
  placeholder="Escreva..."
  toolbar="floating"           // "floating" | "fixed" | "none"
  readOnly={false}
  ref={editorRef}              // focus(), getMarkdown(), setMarkdown()
/>
```

O editor **não conhece o projeto**: upload, menções e navegação entram por callback.
É isso que o mantém reutilizável entre TicketFlow, BISynk e o que vier.

## Integração com Laravel

O host implementa `onUpload` chamando o endpoint que já existir. No TicketFlow:

```ts
async function upload(file: File) {
  const body = new FormData()
  body.append("file", file)

  const resposta = await fetch(`/api/issues/${issueId}/attachments`, { method: "POST", body })
  const { data } = await resposta.json()

  return { url: data.url, alt: data.name }
}
```

Do lado do Laravel, o que o endpoint precisa devolver é só `url` e `name`. O
`AttachmentController` do TicketFlow já faz isso (disco por tenant, 20 MB, rota
`attachments.download`).

**Pendência conhecida**: hoje o anexo exige uma issue existente, então imagem colada
em um formulário de criação não tem onde ser gravada. Duas saídas: criar a issue antes
de abrir o editor, ou expor um endpoint de upload avulso que devolva uma URL temporária.

## Suportado na v1

Parágrafo, títulos (1–3), **negrito**, *itálico*, ~~riscado~~, `código`, links,
citação, bloco de código com linguagem, régua, listas com marcador, numeradas e de
tarefa (`- [ ]`), imagens (colar, arrastar ou botão), quebra de linha, undo/redo,
atalhos de teclado e regras de digitação.

## Fora da v1

- Menções (`@pessoa`) e comandos de barra (`/`) — o alicerce está pronto, falta a UI
  de sugestão e o callback de busca.
- Tabelas.
- Realce de sintaxe no bloco de código (hoje o texto fica monoespaçado, sem cores).
- Edição colaborativa — o ProseMirror tem o mecanismo (steps e rebase); exige servidor.

## Como instalar hoje

```bash
node scripts/sync.mjs ../../TicketFlow/ticketflow-app
```

Depois, no projeto consumidor: instalar as dependências listadas pelo script e
importar `editor.css` uma vez (no `globals.css` ou no layout).

Quando o registry estiver publicado, o mesmo conteúdo é instalável com
`npx shadcn@latest add https://<host>/r/editor.json`.
