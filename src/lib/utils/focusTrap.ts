/**
 * focusTrap — Svelte action to keep focus within an element.
 */
export function focusTrap(node: HTMLElement) {
    const focusableElements = node.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    function handleKeydown(e: KeyboardEvent) {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }

    node.addEventListener('keydown', handleKeydown);
    
    // Auto focus first element
    if (firstElement) {
        setTimeout(() => firstElement.focus(), 50);
    }

    return {
        destroy() {
            node.removeEventListener('keydown', handleKeydown);
        }
    };
}
