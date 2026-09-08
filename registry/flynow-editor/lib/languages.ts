import { common, createLowlight } from "lowlight"

/**
 * Realce compartilhado por todos os blocos. `common` traz as linguagens mais
 * usadas; para incluir outra, registre aqui com `lowlight.register(nome, def)`.
 */
export const lowlight = createLowlight(common)

/**
 * Linguagens do seletor. `value` é o nome que o highlight.js entende e também o
 * que vai para a cerca do Markdown; `null` deixa a detecção por conta do editor.
 */
export const codeLanguages: { value: string | null; label: string }[] = [
  { value: null, label: "Detectar" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "css", label: "CSS" },
  { value: "diff", label: "Diff" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "xml", label: "HTML/XML" },
  { value: "ini", label: "INI/TOML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "kotlin", label: "Kotlin" },
  { value: "less", label: "Less" },
  { value: "lua", label: "Lua" },
  { value: "makefile", label: "Makefile" },
  { value: "markdown", label: "Markdown" },
  { value: "objectivec", label: "Objective-C" },
  { value: "perl", label: "Perl" },
  { value: "php", label: "PHP" },
  { value: "plaintext", label: "Texto" },
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scss", label: "SCSS" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "typescript", label: "TypeScript" },
  { value: "vbnet", label: "VB.NET" },
  { value: "yaml", label: "YAML" },
]

/** Nome de exibição de uma linguagem; sem correspondência, mostra o próprio valor. */
export function languageLabel(value: string | null): string {
  const conhecida = codeLanguages.find((item) => item.value === value)
  if (conhecida) return conhecida.label

  return value ? value.toUpperCase() : "Detectar"
}

/** A linguagem está registrada no realce? Evita exceção com valor desconhecido. */
export function isSupported(value: string | null): value is string {
  return value !== null && lowlight.registered(value)
}
