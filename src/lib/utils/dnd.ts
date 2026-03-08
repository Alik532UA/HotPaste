/**
 * Simple HTML5 Drag and Drop actions for Svelte
 */

export function draggable(node: HTMLElement, index: number) {
    node.setAttribute('draggable', 'true');

    function handleDragStart(e: DragEvent) {
        if (!e.dataTransfer) return;

        // Only allow dragging if the target is the drag-handle or if we are not clicking on text that might be selectable
        const target = e.target as HTMLElement;

        // Don't drag if clicking buttons, textareas, etc
        if (target.closest('button') || target.closest('textarea')) {
            e.preventDefault();
            return;
        }

        // To prevent text selection drag from triggering card drag...
        // Svelte handles it reasonably but let's be safe.

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());

        setTimeout(() => {
            node.classList.add('dragging');
        }, 0);
    }

    function handleDragEnd() {
        node.classList.remove('dragging');
    }

    node.addEventListener('dragstart', handleDragStart);
    node.addEventListener('dragend', handleDragEnd);

    return {
        update(newIndex: number) {
            index = newIndex;
        },
        destroy() {
            node.removeEventListener('dragstart', handleDragStart);
            node.removeEventListener('dragend', handleDragEnd);
        }
    };
}

export interface DropzoneOptions {
    index: number;
    onDrop: (fromIndex: number, toIndex: number) => void;
}

export function dropzone(node: HTMLElement, options: DropzoneOptions) {
    let toIndex: number = options.index;
    let onDrop = options.onDrop;

    // We attach this to a specific index inside the each loop, or we can make toIndex dynamic
    // Actually, passing the current index via update is better.

    function handleDragOver(e: DragEvent) {
        e.preventDefault(); // Necessary to allow dropping
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDragEnter(e: DragEvent) {
        e.preventDefault();
        // optionally add a class to show it's a valid drop target
        node.classList.add('drag-over');
    }

    function handleDragLeave() {
        node.classList.remove('drag-over');
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        node.classList.remove('drag-over');

        if (!e.dataTransfer) return;
        const fromIndexStr = e.dataTransfer.getData('text/plain');
        if (!fromIndexStr) return;

        const fromIndex = parseInt(fromIndexStr, 10);
        if (toIndex !== null && !isNaN(fromIndex) && fromIndex !== toIndex) {
            onDrop(fromIndex, toIndex);
        }
    }

    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('dragenter', handleDragEnter);
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('drop', handleDrop);

    return {
        update(newOptions: DropzoneOptions) {
            toIndex = newOptions.index;
            onDrop = newOptions.onDrop;
        },
        destroy() {
            node.removeEventListener('dragover', handleDragOver);
            node.removeEventListener('dragenter', handleDragEnter);
            node.removeEventListener('dragleave', handleDragLeave);
            node.removeEventListener('drop', handleDrop);
        }
    };
}
