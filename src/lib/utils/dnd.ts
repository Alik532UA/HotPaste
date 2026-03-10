/**
 * Simple HTML5 Drag and Drop actions for Svelte with Live Update support
 */
import { logService } from '../services/logService.svelte';

// Shared state for live dragging
let currentDraggedIndex: number | null = null;
let currentDraggedType: string | null = null;

// Prevent default browser behavior for drag and drop globally
// This is CRITICAL for Tauri/WebView2 to allow dropping anywhere
if (typeof window !== 'undefined') {
    const preventDefault = (e: DragEvent) => {
        // We must prevent default to allow DND to work
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    };

    window.addEventListener('dragover', preventDefault, false);
    window.addEventListener('dragenter', preventDefault, false);
    
    window.addEventListener('drop', (e) => {
        // Only prevent default if it's our internal DND to not break file uploads if needed
        if (e.dataTransfer?.types.includes('application/hotpaste-index') || 
            e.dataTransfer?.types.includes('text/plain')) {
            e.preventDefault();
        }
        currentDraggedIndex = null;
        currentDraggedType = null;
    }, false);
}

export function draggable(node: HTMLElement, options: { index: number, type: string }) {
    let index = options.index;
    let type = options.type;

    node.setAttribute('draggable', 'true');

    function handleMouseDown(e: MouseEvent) {
        const target = e.target as HTMLElement;
        // Stop Tauri from stealing the drag if we are on a handle or a card
        // We use stopImmediatePropagation to be even more forceful
        if (target.closest('.drag-handle') || node.classList.contains('tab') || node.classList.contains('card-wrapper')) {
            e.stopPropagation();
        }
    }

    function handleDragStart(e: DragEvent) {
        if (!e.dataTransfer) return;

        const target = e.target as HTMLElement;
        logService.log('dnd', `DragStart: index ${index}, type: ${type}`);
        
        // Stop event from bubbling to Tauri's window drag logic
        e.stopPropagation();

        if (target.closest('input') || target.closest('textarea')) {
            e.preventDefault();
            return;
        }

        // Only allow dragging from handle for cards, or anywhere for tabs
        if (type === 'card' && !target.closest('.drag-handle')) {
            if (!node.classList.contains('card-wrapper')) {
                e.preventDefault();
                return;
            }
        }

        // REQUIRED for Webview2/Tauri to show the correct cursor
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.dropEffect = 'move';
        
        const data = index.toString();
        // Always set text/plain for maximum compatibility
        e.dataTransfer.setData('text/plain', data);
        
        // Custom types for our internal logic
        const mimeType = `application/hotpaste-index-${type}`;
        e.dataTransfer.setData(mimeType, data);
        e.dataTransfer.setData('application/hotpaste-index', data); 
        
        currentDraggedIndex = index;
        currentDraggedType = type;
        
        node.classList.add('dragging');
        
        // Visual feedback
        setTimeout(() => {
            if (node) node.style.opacity = '0.3';
        }, 0);
    }

    function handleDragEnd(e: DragEvent) {
        logService.log('dnd', `DragEnd: index ${index}`);
        node.classList.remove('dragging');
        node.style.opacity = '';
        currentDraggedIndex = null;
        currentDraggedType = null;
    }

    node.addEventListener('mousedown', handleMouseDown, { capture: true });
    node.addEventListener('dragstart', handleDragStart);
    node.addEventListener('dragend', handleDragEnd);

    return {
        update(newOptions: { index: number, type: string }) {
            index = newOptions.index;
            type = newOptions.type;
        },
        destroy() {
            node.removeEventListener('mousedown', handleMouseDown, { capture: true });
            node.removeEventListener('dragstart', handleDragStart);
            node.removeEventListener('dragend', handleDragEnd);
        }
    };
}

export interface DropzoneOptions {
    index: number;
    type: string;
    onMove?: (fromIndex: number, toIndex: number) => void;
    onDrop: (fromIndex: number, toIndex: number) => void;
}

export function dropzone(node: HTMLElement, options: DropzoneOptions) {
    let toIndex = options.index;
    let type = options.type;
    let onDrop = options.onDrop;
    let onMove = options.onMove;

    const mimeType = `application/hotpaste-index-${type}`;

    function handleDragOver(e: DragEvent) {
        // Always prevent default in dragover to allow drop in Tauri
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
        return false;
    }

    function handleDragEnter(e: DragEvent) {
        // We must preventDefault here too
        e.preventDefault();
        
        // Filter by type if we have dataTransfer types
        const types = e.dataTransfer?.types || [];
        const isOurType = types.includes(mimeType) || types.includes('application/hotpaste-index');
        
        if (!isOurType && !types.includes('text/plain')) return;
        
        node.classList.add('drag-over');

        // LIVE UPDATE
        if (onMove && currentDraggedIndex !== null && currentDraggedIndex !== toIndex && currentDraggedType === type) {
            onMove(currentDraggedIndex, toIndex);
            currentDraggedIndex = toIndex;
        }
    }

    function handleDragLeave() {
        node.classList.remove('drag-over');
    }

    function handleDrop(e: DragEvent) {
        node.classList.remove('drag-over');
        
        const data = e.dataTransfer?.getData(mimeType) || 
                     e.dataTransfer?.getData('application/hotpaste-index') || 
                     e.dataTransfer?.getData('text/plain');
        
        if (!data) return;
        
        e.preventDefault();
        e.stopPropagation();

        const fromIndex = parseInt(data, 10);
        logService.log('dnd', `Drop event: from ${fromIndex} to ${toIndex} (type: ${type})`);
        
        if (!isNaN(fromIndex) && fromIndex !== toIndex) {
            onDrop(fromIndex, toIndex);
        }
        
        currentDraggedIndex = null;
        currentDraggedType = null;
    }

    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('dragenter', handleDragEnter);
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('drop', handleDrop);

    return {
        update(newOptions: DropzoneOptions) {
            toIndex = newOptions.index;
            type = newOptions.type;
            onDrop = newOptions.onDrop;
            onMove = newOptions.onMove;
        },
        destroy() {
            node.removeEventListener('dragover', handleDragOver);
            node.removeEventListener('dragenter', handleDragEnter);
            node.removeEventListener('dragleave', handleDragLeave);
            node.removeEventListener('drop', handleDrop);
        }
    };
}
