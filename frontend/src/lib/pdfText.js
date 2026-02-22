/** Normalize PDF-extracted text: collapse layout-induced line breaks within paragraphs,
 * but preserve paragraph breaks (2+ newlines). */
export function normalizePdfText(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .split(/(?:\r?\n\s*){2,}/)           // split on 2+ newlines = paragraph boundaries
    .map((p) => p.replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
    .join('\n\n');                        // rejoin with double newline = paragraph break
}
