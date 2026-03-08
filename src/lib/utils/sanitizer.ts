import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML string to prevent XSS attacks.
 * Used for safe Markdown rendering.
 */
export function sanitize(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'ul', 'ol', 'li', 
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'hr', 'br',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'title', 'class']
    });
}
