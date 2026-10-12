/**
 * Санітизація HTML та SVG для HotPaste (SECURITY-v10 § 5.2).
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  return dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export function sanitizeSvg(svg: string): string {
  if (!svg) return "";
  return sanitizeHtml(svg);
}
