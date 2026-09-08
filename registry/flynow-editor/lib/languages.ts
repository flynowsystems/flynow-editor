/** Linguagens oferecidas no bloco de código. `null` é "detectar" — sem marcação. */
export const codeLanguages: { value: string | null; label: string }[] = [
  { value: null, label: "Plaintext" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "css", label: "CSS" },
  { value: "dart", label: "Dart" },
  { value: "diff", label: "Diff" },
  { value: "docker", label: "Dockerfile" },
  { value: "elixir", label: "Elixir" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "kotlin", label: "Kotlin" },
  { value: "lua", label: "Lua" },
  { value: "markdown", label: "Markdown" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scss", label: "SCSS" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "toml", label: "TOML" },
  { value: "tsx", label: "TSX" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
]

/** Nome de exibição da linguagem guardada no nó. */
export function languageLabel(value: string | null): string {
  return codeLanguages.find((item) => item.value === value)?.label ?? value ?? "Plaintext"
}
