/**
 * Advanced Drag and Drop actions for Svelte with multi-type and data support.
 */
import { logService } from '../services/logService.svelte';

// Shared state for live dragging tracking
let currentDraggedData: any = null;
let currentDraggedType: string | null = null;

/**
 * Draggable action: makes an element draggable and attaches data.
 */
export function draggable(node: HTMLElement, options: { data: any, type: string, handle?: string }) {
    let { data, type, handle } = options;

    node.setAttribute('draggable', 'true');

    function handleMouseDown(e: MouseEvent) {
        const target = e.target as HTMLElement;
        // If handle is specified, only allow dragging from that handle
        if (handle && !target.closest(handle)) {
            // But allow it if it's a tab or some other specific element
            if (!node.classList.contains('tab')) {
                return;
            }
        }
        e.stopPropagation();
    }

    function handleDragStart(e: DragEvent) {
        if (!e.dataTransfer) return;

        const target = e.target as HTMLElement;
        logService.log('dnd', `DragStart: type=${type}`, data);
        
        e.stopPropagation();

        if (target.closest('input') || target.closest('textarea')) {
            e.preventDefault();
            return;
        }

        // Apply visual style
        node.classList.add('dragging');

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.dropEffect = 'move';
        
        // Store data in multiple formats
        const stringData = typeof data === 'string' ? data : JSON.stringify(data);
        e.dataTransfer.setData('text/plain', stringData);
        e.dataTransfer.setData(`application/hotpaste-${type}`, stringData);
        
        currentDraggedData = data;
        currentDraggedType = type;
        
        // Visual trick for ghost image
        setTimeout(() => {
            if (node) node.style.opacity = '0.3';
        }, 0);
    }

    function handleDragEnd() {
        node.classList.remove('dragging');
        node.style.opacity = '';
        currentDraggedData = null;
        currentDraggedType = null;
    }

    node.addEventListener('mousedown', handleMouseDown, { capture: true });
    node.addEventListener('dragstart', handleDragStart);
    node.addEventListener('dragend', handleDragEnd);

    return {
        update(newOptions: { data: any, type: string, handle?: string }) {
            data = newOptions.data;
            type = newOptions.type;
            handle = newOptions.handle;
        },
        destroy() {
            node.removeEventListener('mousedown', handleMouseDown, { capture: true });
            node.removeEventListener('dragstart', handleDragStart);
            node.removeEventListener('dragend', handleDragEnd);
        }
    };
}

export interface DropzoneOptions {
    type: string; // The type of draggable this zone accepts
    data?: any;   // Context data for this dropzone (e.g., target folder or tab)
    onMove?: (fromData: any, toData: any) => void;
    onDrop: (fromData: any, toData: any) => void;
}

/**
 * Dropzone action: handles drag enter/over/drop for specific types.
 */
export function dropzone(node: HTMLElement, options: DropzoneOptions) {
    let { type, data: toData, onDrop, onMove } = options;

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
        return false;
    }

    function handleDragEnter(e: DragEvent) {
        e.preventDefault();
        
        // Check if the dragged item matches the accepted type
        if (currentDraggedType !== type) return;
        
        node.classList.add('drag-over');

        // Optional Live Reordering (only if types match and data differs)
        if (onMove && currentDraggedData !== null && currentDraggedData !== toData) {
            // For live update, we usually only do this for the SAME context (e.g. reordering within same folder)
            // But let's pass it up to the handler to decide.
            onMove(currentDraggedData, toData);
        }
    }

    function handleDragLeave() {
        node.classList.remove('drag-over');
    }

    function handleDrop(e: DragEvent) {
        node.classList.remove('drag-over');
        if (currentDraggedType !== type) return;

        const rawData = e.dataTransfer?.getData(`application/hotpaste-${type}`) || 
                        e.dataTransfer?.getData('text/plain');
        
        if (!rawData) return;
        
        e.preventDefault();
        e.stopPropagation();

        let fromData = currentDraggedData;
        if (fromData === null) {
            try {
                fromData = JSON.parse(rawData);
            } catch {
                fromData = rawData;
            }
        }

        logService.log('dnd', `Drop: type=${type}`, { from: fromData, to: toData });
        
        onDrop(fromData, toData);
        
        currentDraggedData = null;
        currentDraggedType = null;
    }

    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('dragenter', handleDragEnter);
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('drop', handleDrop);

    return {
        update(newOptions: DropzoneOptions) {
            type = newOptions.type;
            toData = newOptions.data;
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
