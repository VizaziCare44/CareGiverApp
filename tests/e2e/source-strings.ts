/**
 * The string literals of a source file, for the quality-gate searches that look at the words a screen
 * can show (DEV-075, DEV-076). Comments are removed first, so a comment that names the words the
 * screen must never use ("arrived", "Required") is not mistaken for text on the screen.
 */
export function stringsOf(source: string): string {
  const withoutComments = source
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
  return [...withoutComments.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]).join('\n')
}
