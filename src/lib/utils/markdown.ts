/**
 * Markdown rendering utility.
 * Lazily loads snarkdown only when needed to reduce initial bundle size.
 */
export async function renderMarkdown(content: string): Promise<string> {
    const { default: snarkdown } = await import('snarkdown');
    return snarkdown(content);
}
