/**
 * A source file without its comments, for the quality-gate searches (DEV-075, DEV-076): a comment that
 * names what the screen must never do ("markdown", "Required") is not the screen doing it.
 */
export function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => {
      // a // comment: from the first // that is not inside a quote
      let quote = ''
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i]
        if (quote) {
          if (c === '\\') i += 1
          else if (c === quote) quote = ''
        } else if (c === '"' || c === "'" || c === '`') quote = c
        else if (c === '/' && line[i + 1] === '/') return line.slice(0, i)
      }
      return line
    })
    .join('\n')
}

/**
 * The string literals of a source file, comments removed first, for the searches that look at the words
 * a screen can show.
 */
export function stringsOf(source: string): string {
  return [...codeOf(source).matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]).join('\n')
}
