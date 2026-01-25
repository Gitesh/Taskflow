/*==================================*/
/* Enhanced Markdown Notes Editor */
/* Refactored Architecture - Phase 1 */
/*==================================*/

/**
 * Enhanced Markdown Editor with modular architecture
 * Features: Auto-save, performance optimizations, accessibility, extended markdown support
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const sanitizeHTML = (html) => {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
};

const escapeHtml = (text) => {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

// ============================================================================
// IMAGE STORAGE CLASS (Enhanced)
// ============================================================================

class ImageStorage {
    constructor() {
        this.dbName = 'TaskflowImages';
        this.storeName = 'images';
        this.metadataStore = 'metadata';
        this.db = null;
        this.version = 2; // Upgraded for metadata support
    }

    async init() {
        try {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.version);

                request.onupgradeneeded = (e) => {
                    const db = e.target.result;

                    // Create images store if it doesn't exist
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName);
                    }

                    // Create metadata store (new in v2)
                    if (!db.objectStoreNames.contains(this.metadataStore)) {
                        const metaStore = db.createObjectStore(this.metadataStore, { keyPath: 'id' });
                        metaStore.createIndex('taskIndex', 'taskIndex', { unique: false });
                        metaStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                };

                request.onsuccess = (e) => {
                    this.db = e.target.result;
                    resolve(this.db);
                };

                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('Failed to initialize image storage:', error);
            throw error;
        }
    }

    async saveImage(id, blob, metadata = {}) {
        try {
            if (!this.db) await this.init();

            // Compress image if it's large (> 500KB)
            let finalBlob = blob;
            if (blob.size > 500000 && blob.type.startsWith('image/')) {
                finalBlob = await this.compressImage(blob);
            }

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName, this.metadataStore], 'readwrite');

                // Save image blob
                const imageStore = transaction.objectStore(this.storeName);
                const imageRequest = imageStore.put(finalBlob, id);

                // Save metadata
                const metaStore = transaction.objectStore(this.metadataStore);
                const metaData = {
                    id: id,
                    timestamp: new Date().toISOString(),
                    originalSize: blob.size,
                    compressedSize: finalBlob.size,
                    altText: metadata.altText || 'screenshot',
                    taskIndex: metadata.taskIndex || null
                };
                const metaRequest = metaStore.put(metaData);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('Failed to save image:', error);
            throw error;
        }
    }

    async compressImage(blob, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // Maintain aspect ratio, max 1920px width
                let width = img.width;
                let height = img.height;
                const maxWidth = 1920;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((compressedBlob) => {
                    resolve(compressedBlob || blob);
                }, blob.type, quality);
            };

            img.onerror = () => resolve(blob);
            img.src = URL.createObjectURL(blob);
        });
    }

    async getImage(id) {
        try {
            if (!this.db) await this.init();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(id);
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('Failed to get image:', error);
            return null;
        }
    }

    async getAllImages() {
        try {
            if (!this.db) await this.init();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();
                const keyRequest = store.getAllKeys();

                let images = {};
                request.onsuccess = () => {
                    keyRequest.onsuccess = () => {
                        const keys = keyRequest.result;
                        const values = request.result;
                        keys.forEach((key, i) => {
                            images[key] = values[i];
                        });
                        resolve(images);
                    };
                };
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('Failed to get all images:', error);
            return {};
        }
    }

    async cleanupOrphanedImages(taskData) {
        try {
            if (!this.db) await this.init();

            // Get all image IDs referenced in task notes
            const referencedIds = new Set();
            taskData.forEach(task => {
                if (task.notes) {
                    const matches = task.notes.match(/tf-img:\/\/(img_\d+)/g);
                    if (matches) {
                        matches.forEach(match => {
                            const id = match.replace('tf-img://', '');
                            referencedIds.add(id);
                        });
                    }
                }
            });

            // Get all stored image IDs
            const transaction = this.db.transaction([this.storeName, this.metadataStore], 'readwrite');
            const imageStore = transaction.objectStore(this.storeName);
            const metaStore = transaction.objectStore(this.metadataStore);
            const keysRequest = imageStore.getAllKeys();

            keysRequest.onsuccess = () => {
                const allIds = keysRequest.result;
                let deletedCount = 0;

                allIds.forEach(id => {
                    if (!referencedIds.has(id)) {
                        imageStore.delete(id);
                        metaStore.delete(id);
                        deletedCount++;
                    }
                });

                console.log(`Cleaned up ${deletedCount} orphaned images`);
            };
        } catch (error) {
            console.error('Failed to cleanup orphaned images:', error);
        }
    }
}

// ============================================================================
// MARKDOWN PARSER CLASS (Enhanced)
// ============================================================================

class MarkdownParser {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 100;
    }

    parse(text) {
        const cacheKey = text;
        if (this.cache.has(cacheKey)) {
            // Move to end (LRU)
            const value = this.cache.get(cacheKey);
            this.cache.delete(cacheKey);
            this.cache.set(cacheKey, value);
            return value;
        }

        try {
            const html = this.parseMarkdown(text);
            this.cache.set(cacheKey, html);

            // LRU eviction
            if (this.cache.size > this.maxCacheSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            return html;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<div class="error">Markdown parsing failed: ${error.message}</div>`;
        }
    }

    parseMarkdown(text) {
        if (!text) return "";

        const lines = text.split('\n');
        let htmlResult = [];
        let inList = false;
        let inBlockquote = false;
        let inCodeBlock = false;
        let codeBlockLang = '';

        const parseInline = (str) => {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/<u>(.*?)<\/u>/gi, '<u>$1</u>')
                .replace(/~~(.*?)~~/g, '<strike>$1</strike>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\[ \]/g, '<input type="checkbox" aria-label="Task item">')
                .replace(/\[x\]/g, '<input type="checkbox" checked aria-label="Completed task">')
                .replace(/-a-/gi, '<span class="note-tag action" contenteditable="false" role="button" tabindex="0" aria-label="Action tag" onclick="clkNoteTag(\'action\')">action</span>')
                .replace(/-f-/gi, '<span class="note-tag finding" contenteditable="false" role="button" tabindex="0" aria-label="Finding tag" onclick="clkNoteTag(\'finding\')">finding</span>')
                .replace(/-d-/gi, '<span class="note-tag documentation" contenteditable="false" role="button" tabindex="0" aria-label="Documentation tag" onclick="clkNoteTag(\'documentation\')">documentation</span>')
                .replace(/-q-/gi, '<span class="note-tag question" contenteditable="false" role="button" tabindex="0" aria-label="Question tag" onclick="clkNoteTag(\'question\')">question</span>')
                .replace(/!\[(.*?)\]\(tf-img:\/\/(.*?)\)/g, '<img class="pasted-image" alt="$1" data-img-id="$2" onclick="openFullscreenImage(this.src)" loading="lazy">')
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                .replace(/(^|[^"'])(https?:\/\/[^\s\)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
        };

        const parseTable = (lines, startIndex) => {
            const tableLines = [];
            let i = startIndex;

            while (i < lines.length && lines[i].trim().includes('|')) {
                tableLines.push(lines[i]);
                i++;
            }

            if (tableLines.length < 2) return { html: '', nextIndex: i };

            let tableHTML = '<table class="markdown-table" role="table"><thead><tr>';
            const headerCells = tableLines[0].split('|').map(cell => cell.trim()).filter(cell => cell);
            headerCells.forEach(cell => {
                tableHTML += `<th>${parseInline(cell)}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';

            for (let j = 2; j < tableLines.length; j++) {
                tableHTML += '<tr>';
                const cells = tableLines[j].split('|').map(cell => cell.trim()).filter(cell => cell);
                cells.forEach(cell => {
                    tableHTML += `<td>${parseInline(cell)}</td>`;
                });
                tableHTML += '</tr>';
            }

            tableHTML += '</tbody></table>';
            return { html: tableHTML, nextIndex: i };
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const rawLine = line.trim();

            // Code blocks
            if (rawLine.startsWith('```')) {
                if (inCodeBlock) {
                    htmlResult.push('</code></pre>');
                    inCodeBlock = false;
                    codeBlockLang = '';
                } else {
                    inCodeBlock = true;
                    codeBlockLang = rawLine.substring(3).trim();
                    htmlResult.push(`<pre class="code-block ${codeBlockLang}"><code class="language-${codeBlockLang}">`);
                }
                continue;
            }

            if (inCodeBlock) {
                htmlResult.push(escapeHtml(line));
                continue;
            }

            // Tables
            if (rawLine.includes('|') && !inList) {
                const tableResult = parseTable(lines, i);
                htmlResult.push(tableResult.html);
                i = tableResult.nextIndex - 1;
                continue;
            }

            // Blockquotes
            if (rawLine.startsWith('>')) {
                if (!inBlockquote) {
                    htmlResult.push('<blockquote class="markdown-blockquote">');
                    inBlockquote = true;
                }
                htmlResult.push(`<div contenteditable="true" data-line="${i}">${parseInline(rawLine.substring(1).trim())}</div>`);
                continue;
            }

            if (inBlockquote) {
                htmlResult.push('</blockquote>');
                inBlockquote = false;
            }

            // Horizontal Rule
            if (rawLine === '---' || rawLine === '***' || rawLine === '___') {
                if (inList) { htmlResult.push('</ul>'); inList = false; }
                htmlResult.push('<hr class="markdown-hr">');
                continue;
            }

            // Empty lines
            if (rawLine === '' && !inList) {
                htmlResult.push(`<div contenteditable="true" data-line="${i}" class="empty-line">&nbsp;</div>`);
                continue;
            }

            // Headings
            if (rawLine.startsWith('# ')) {
                if (inList) { htmlResult.push('</ul>'); inList = false; }
                htmlResult.push(`<h1 contenteditable="true" data-line="${i}" class="markdown-h1">${parseInline(rawLine.substring(2))}</h1>`);
            } else if (rawLine.startsWith('## ')) {
                if (inList) { htmlResult.push('</ul>'); inList = false; }
                htmlResult.push(`<h2 contenteditable="true" data-line="${i}" class="markdown-h2">${parseInline(rawLine.substring(3))}</h2>`);
            } else if (rawLine.startsWith('### ')) {
                if (inList) { htmlResult.push('</ul>'); inList = false; }
                htmlResult.push(`<h3 contenteditable="true" data-line="${i}" class="markdown-h3">${parseInline(rawLine.substring(4))}</h3>`);
            }
            // Lists & Task Lists
            else if (rawLine.match(/^[-*]\s/)) {
                if (!inList) {
                    htmlResult.push('<ul class="markdown-list">');
                    inList = true;
                }
                const isTask = rawLine.includes('[ ]') || rawLine.includes('[x]');
                const content = parseInline(rawLine.substring(rawLine.match(/^[-*]\s/)[0].length));
                htmlResult.push(`<li class="${isTask ? 'task-item' : ''}" contenteditable="true" data-line="${i}">${content}</li>`);
            } else {
                if (inList) {
                    htmlResult.push('</ul>');
                    inList = false;
                }
                if (rawLine !== '') {
                    htmlResult.push(`<div contenteditable="true" data-line="${i}" class="markdown-paragraph">${parseInline(rawLine)}</div>`);
                }
            }
        }

        // Close any open blocks
        if (inList) htmlResult.push('</ul>');
        if (inBlockquote) htmlResult.push('</blockquote>');
        if (inCodeBlock) htmlResult.push('</code></pre>');

        return htmlResult.join('');
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.cache.keys()).map(k => k.substring(0, 50))
        };
    }
}

// ============================================================================
// TEXT SELECTION HELPER (Enhanced with Selection API)
// ============================================================================

class TextSelection {
    constructor(textarea) {
        this.textarea = textarea;
    }

    getSelectedText() {
        return this.textarea.value.substring(this.textarea.selectionStart, this.textarea.selectionEnd);
    }

    insertText(text, replaceSelection = true) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;

        let newValue;
        if (replaceSelection) {
            newValue = value.substring(0, start) + text + value.substring(end);
        } else {
            newValue = value.substring(0, end) + text + value.substring(end);
        }

        this.textarea.value = newValue;

        // Restore cursor position
        const newCursorPos = replaceSelection ? start + text.length : end + text.length;
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);

        // Trigger input event
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    wrapSelection(before, after) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const selectedText = this.getSelectedText();
        const text = this.textarea.value;

        // Check if already wrapped
        const beforeAtStart = text.substring(start - before.length, start);
        const afterAtEnd = text.substring(end, end + after.length);

        if (beforeAtStart === before && afterAtEnd === after) {
            // Unwrap
            this.textarea.setSelectionRange(start - before.length, end + after.length);
            this.insertText(selectedText, true);
        } else {
            // Wrap
            this.insertText(before + selectedText + after, true);
        }
    }

    applyMarkdown(command) {
        const commands = {
            bold: ['**', '**'],
            italic: ['*', '*'],
            underline: ['<u>', '</u>'],
            strikethrough: ['~~', '~~'],
            code: ['`', '`']
        };

        if (commands[command]) {
            const [before, after] = commands[command];
            this.wrapSelection(before, after);
        }
    }
}

// ============================================================================
// HTML TO MARKDOWN CONVERTER (Custom Implementation)
// ============================================================================

class HtmlToMarkdownConverter {
    constructor() {
        this.rules = this.initializeRules();
    }

    initializeRules() {
        return [
            { pattern: /<strong>(.*?)<\/strong>/gi, replacement: '**$1**' },
            { pattern: /<b>(.*?)<\/b>/gi, replacement: '**$1**' },
            { pattern: /<em>(.*?)<\/em>/gi, replacement: '*$1*' },
            { pattern: /<i>(.*?)<\/i>/gi, replacement: '*$1*' },
            { pattern: /<u>(.*?)<\/u>/gi, replacement: '<u>$1</u>' },
            { pattern: /<strike>(.*?)<\/strike>/gi, replacement: '~~$1~~' },
            { pattern: /<s>(.*?)<\/s>/gi, replacement: '~~$1~~' },
            { pattern: /<code>(.*?)<\/code>/gi, replacement: '`$1`' },
            { pattern: /<img.*?data-img-id="(.*?)".*?>/gi, replacement: '![screenshot](tf-img://$1)' },
            { pattern: /<input type="checkbox"[^>]*checked[^>]*>/gi, replacement: '[x] ' }, // Handle checked
            { pattern: /<input type="checkbox"[^>]*>/gi, replacement: '[ ] ' }, // Handle unchecked
            { pattern: /<a.*?href="(.*?)".*?>(.*?)<\/a>/gi, replacement: '[$2]($1)' },
            { pattern: /&nbsp;/g, replacement: ' ' },
            { pattern: /<br\s*\/?>/gi, replacement: '' }
        ];
    }

    convert(html) {
        let markdown = html;

        // Apply all rules
        this.rules.forEach(rule => {
            markdown = markdown.replace(rule.pattern, rule.replacement);
        });

        // Strip remaining HTML tags
        markdown = markdown.replace(/<\/?[^>]+(>|$)/g, "");

        return markdown;
    }
}

// ============================================================================
// EVENT CLEANUP MANAGER
// ============================================================================

class EventCleanupManager {
    constructor() {
        this.listeners = [];
        this.blobUrls = [];
    }

    addEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        this.listeners.push({ element, event, handler, options });
    }

    addBlobUrl(url) {
        this.blobUrls.push(url);
    }

    cleanup() {
        // Remove all event listeners
        this.listeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.listeners = [];

        // Revoke all blob URLs
        this.blobUrls.forEach(url => {
            URL.revokeObjectURL(url);
        });
        this.blobUrls = [];
    }
}

// ============================================================================
// SYNTAX HIGHLIGHTER (Custom Overlay)
// ============================================================================

class SyntaxHighlighter {
    constructor() {
        this.rules = [
            { pattern: /^#+\s.*$/gm, class: 'md-heading' },
            { pattern: /\*\*(.*?)\*\*/g, class: 'md-bold' },
            { pattern: /\*(.*?)\*/g, class: 'md-italic' },
            { pattern: /~~(.*?)~~/g, class: 'md-strike' },
            { pattern: /`(.*?)`/g, class: 'md-code' },
            { pattern: /!\[(.*?)\]\((.*?)\)/g, class: 'md-image' },
            { pattern: /\[(.*?)\]\((.*?)\)/g, class: 'md-link' },
            { pattern: /^[-*]\s/gm, class: 'md-list' },
            { pattern: /^>\s.*$/gm, class: 'md-quote' },
            { pattern: /^- \[([ x])\]/gm, class: 'md-task' },
            { pattern: /^---$/gm, class: 'md-hr' }
        ];
    }

    highlight(text) {
        let html = escapeHtml(text);

        // This is a simplified highlighter. For full accuracy with overlapping tokens,
        // a more complex tokenization approach would be needed. 
        // This regex-replacement approach works for basic cases.
        this.rules.forEach(rule => {
            html = html.replace(rule.pattern, match => {
                return `<span class="${rule.class}">${match}</span>`;
            });
        });

        // Handle trailing newlines for pre-wrap alignment
        // Note: Adding <br> can cause double newlines with pre-wrap
        if (text.endsWith('\n')) {
            html += ' '; // Add space to preserve height without extra line
        }

        return html;
    }
}

// ============================================================================
// LAZY IMAGE LOADER (Performance Optimization)
// ============================================================================

class LazyImageLoader {
    constructor() {
        this.observers = new Map();
        this.loadedImages = new Set();
    }

    observe(img, loadCallback) {
        // Skip if already loaded
        if (this.loadedImages.has(img)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Image is now visible, load it
                    loadCallback(img);
                    this.loadedImages.add(img);
                    observer.unobserve(img);
                    this.observers.delete(img);
                }
            });
        }, {
            // Load when image is within 500px of viewport
            rootMargin: '500px',
            threshold: 0.01
        });

        observer.observe(img);
        this.observers.set(img, observer);
    }

    disconnect() {
        // Clean up all observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.loadedImages.clear();
    }
}

// ============================================================================
// SCROLL SYNC MANAGER
// ============================================================================

class ScrollSyncManager {
    constructor(editor, preview) {
        this.editor = editor;
        this.preview = preview;
        this.isScrolling = false;
        this.timeout = null;
        this.activePeer = null;
    }

    init(cleanupManager) {
        // Source: Editor -> Target: Preview
        cleanupManager.addEventListener(this.editor, 'scroll', () => {
            if (this.activePeer && this.activePeer !== this.editor) return;
            this.activePeer = this.editor;
            this.sync(this.editor, this.preview);
        });

        // Source: Preview -> Target: Editor
        cleanupManager.addEventListener(this.preview, 'scroll', () => {
            if (this.activePeer && this.activePeer !== this.preview) return;
            this.activePeer = this.preview;
            this.sync(this.preview, this.editor);
        });

        // Reset active peer on mouse movements to avoid locking
        cleanupManager.addEventListener(this.editor, 'mouseenter', () => { this.activePeer = this.editor; });
        cleanupManager.addEventListener(this.preview, 'mouseenter', () => { this.activePeer = this.preview; });

        // Also reset when scrolling stops (debounce)
        const resetActive = debounce(() => { this.activePeer = null; }, 200);
        cleanupManager.addEventListener(this.editor, 'scroll', resetActive);
        cleanupManager.addEventListener(this.preview, 'scroll', resetActive);
    }

    sync(source, target) {
        if (this.isScrolling) return;

        window.requestAnimationFrame(() => {
            this.isScrolling = true;

            const sourceScrollable = source.scrollHeight - source.clientHeight;
            const targetScrollable = target.scrollHeight - target.clientHeight;

            // Handle edge case where content fits perfectly (no scroll)
            if (sourceScrollable <= 0) {
                target.scrollTop = 0;
            } else {
                const percentage = source.scrollTop / sourceScrollable;
                const targetScrollTop = percentage * targetScrollable;

                // Allow 5px threshold to avoid jitters
                if (!isNaN(targetScrollTop) && Math.abs(target.scrollTop - targetScrollTop) > 5) {
                    target.scrollTop = targetScrollTop;
                }
            }

            setTimeout(() => { this.isScrolling = false; }, 50); // Small delay to release lock
        });
    }

    // Call this after content updates (e.g. typing)
    forceSync() {
        if (this.activePeer) {
            const target = this.activePeer === this.editor ? this.preview : this.editor;
            this.sync(this.activePeer, target);
        }
    }
}

// ============================================================================
// AUTO-SAVE MANAGER
// ============================================================================

class EditorAutoSave {
    constructor(editor, interval = 2000) {
        this.editor = editor;
        this.interval = interval;
        this.isDirty = false;
        this.lastSaved = null;
        this.saveTimer = null;
        this.statusElement = null;
    }

    setStatusElement(element) {
        this.statusElement = element;
        this.updateStatusUI();
    }

    markDirty() {
        this.isDirty = true;
        this.updateStatusUI('unsaved');

        // Schedule auto-save
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => this.save(), this.interval);
    }

    async save() {
        if (!this.isDirty) return;

        try {
            this.updateStatusUI('saving');
            await this.editor.save();
            this.isDirty = false;
            this.lastSaved = new Date();
            this.updateStatusUI('saved');
        } catch (error) {
            console.error('Auto-save failed:', error);
            this.updateStatusUI('error');
        }
    }

    updateStatusUI(status = 'saved') {
        if (!this.statusElement) return;

        const statusConfig = {
            saved: { text: 'Saved', class: 'saved', icon: 'check_circle' },
            saving: { text: 'Saving...', class: 'saving', icon: 'sync' },
            unsaved: { text: 'Unsaved', class: 'unsaved', icon: 'edit' },
            error: { text: 'Save failed', class: 'error', icon: 'error' }
        };

        const config = statusConfig[status] || statusConfig.saved;
        this.statusElement.className = `notes-save-status ${config.class}`;

        let timeText = '';
        if (this.lastSaved && status === 'saved') {
            const seconds = Math.floor((new Date() - this.lastSaved) / 1000);
            if (seconds < 60) {
                timeText = ` ${seconds}s ago`;
            } else {
                const minutes = Math.floor(seconds / 60);
                timeText = ` ${minutes}m ago`;
            }
        }

        this.statusElement.innerHTML = `
            <i class="material-icons">${config.icon}</i>
            <span>${config.text}${timeText}</span>
        `;
    }

    getStatus() {
        return this.isDirty ? 'unsaved' : 'saved';
    }

    destroy() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
    }
}

// ============================================================================
// Continue with MarkdownEditor class in next part...
// ============================================================================
// ============================================================================
// MARKDOWN EDITOR CLASS (Main Controller)
// ============================================================================

class MarkdownEditor {
    constructor(taskIndex, taskData) {
        this.taskIndex = taskIndex;
        this.task = taskData;
        this.dialog = null;
        this.textarea = null;
        this.preview = null;
        this.paneEditor = null;
        this.panePreview = null;

        // Dependencies
        this.parser = new MarkdownParser();
        this.imageStorage = new ImageStorage();
        this.textSelection = null;
        this.htmlConverter = new HtmlToMarkdownConverter();
        this.cleanupManager = new EventCleanupManager();
        this.autoSave = null;
        this.lazyImageLoader = new LazyImageLoader();
        this.scrollSync = null;

        // State
        this.lastActiveElement = null;
        this.currentView = 'split';
    }

    async open() {
        try {
            // Close existing modal if any
            const existing = document.getElementById("idNotesModal");
            if (existing) {
                existing.close();
                existing.remove();
            }

            // Initialize image storage
            await this.imageStorage.init();

            // Create dialog
            this.createDialog();

            // Setup elements
            this.setupElements();

            // Setup auto-save
            this.setupAutoSave();

            // Setup event listeners
            this.setupEventListeners();

            // Initial render
            await this.updatePreview();

            // Show modal
            this.dialog.showModal();

            // Focus textarea
            this.textarea.focus();
        } catch (error) {
            console.error('Failed to open editor:', error);
            throw error;
        }
    }

    createDialog() {
        this.dialog = document.createElement("dialog");
        this.dialog.id = "idNotesModal";
        this.dialog.className = "clsNotesModal";
        document.body.appendChild(this.dialog);

        // Determine priority color
        const headerColor = this.task.priority === 1 ? "var(--color-accent)" : "var(--color-primary)";

        this.dialog.innerHTML = `
        <div class="notes-modal-content">
          <div class="notes-header" style="background: ${headerColor}">
            <div class="notes-header-left">
              <h2 class="notes-task-title">${this.task.title}</h2>
              <p class="notes-task-detail">${this.task.description}</p>
            </div>
            <div class="notes-header-right">
              <div class="notes-save-status" id="idSaveStatus">
                <i class="material-icons">check_circle</i>
                <span>Saved</span>
              </div>
              <div class="notes-view-toggle">
                <button class="notes-toggle-btn" id="btnViewEditor" aria-label="Editor only view">Editor</button>
                <button class="notes-toggle-btn active" id="btnViewSplit" aria-label="Split view">Split</button>
                <button class="notes-toggle-btn" id="btnViewPreview" aria-label="Preview only view">Preview</button>
              </div>
              <button class="notes-export-btn" id="btnExport" aria-label="Export options" title="Export">
                <i class="material-icons">download</i>
              </button>
            </div>
          </div>

          <div class="notes-toolbar" role="toolbar" aria-label="Formatting toolbar">
            <i class="material-icons" title="Undo (Ctrl+Z)" tabindex="0" role="button" aria-label="Undo" data-action="undo">undo</i>
            <i class="material-icons" title="Redo (Ctrl+Y)" tabindex="0" role="button" aria-label="Redo" data-action="redo">redo</i>
            <div class="notes-toolbar-divider"></div>
            <i class="material-icons" title="Bold (Ctrl+B)" tabindex="0" role="button" aria-label="Bold" data-action="bold">format_bold</i>
            <i class="material-icons" title="Italic (Ctrl+I)" tabindex="0" role="button" aria-label="Italic" data-action="italic">format_italic</i>
            <i class="material-icons" title="Underline (Ctrl+U)" tabindex="0" role="button" aria-label="Underline" data-action="underline">format_underlined</i>
            <i class="material-icons" title="Strikethrough" tabindex="0" role="button" aria-label="Strikethrough" data-action="strikethrough">format_strikethrough</i>
            <i class="material-icons" title="Inline Code" tabindex="0" role="button" aria-label="Inline code" data-action="code">code</i>
            <div class="notes-toolbar-divider"></div>
            <i class="material-icons" title="Heading 1" tabindex="0" role="button" aria-label="Heading 1" data-action="header1">filter_1</i>
            <i class="material-icons" title="Heading 2" tabindex="0" role="button" aria-label="Heading 2" data-action="header2">filter_2</i>
            <i class="material-icons" title="Heading 3" tabindex="0" role="button" aria-label="Heading 3" data-action="header3">filter_3</i>
            <div class="notes-toolbar-divider"></div>
            <i class="material-icons" title="Link" tabindex="0" role="button" aria-label="Insert link" data-action="link">link</i>
            <i class="material-icons" title="Bullet List" tabindex="0" role="button" aria-label="Bullet list" data-action="list">format_list_bulleted</i>
            <i class="material-icons" title="Task List" tabindex="0" role="button" aria-label="Task list" data-action="task">check_box</i>
            <i class="material-icons" title="Separator" tabindex="0" role="button" aria-label="Horizontal rule" data-action="hr">horizontal_rule</i>
          </div>

          <div class="notes-editor-container">
            <div class="notes-editor-pane" id="paneEditor">
              <label for="idNotesTextarea">Notes (Markdown)</label>
              <div class="editor-wrapper">
                  <pre class="syntax-layer" id="idSyntaxLayer" aria-hidden="true"></pre>
                  <textarea id="idNotesTextarea" aria-label="Markdown editor" placeholder="Type your notes here... Use # for headings, ** for bold, etc.">${this.task.notes || ""}</textarea>
              </div>
            </div>
            <div class="notes-preview-pane" id="panePreview">
              <label>Preview</label>
              <div id="idNotesPreview" role="region" aria-live="polite" aria-label="Markdown preview"></div>
            </div>
          </div>
          
          <div class="notes-footer">
            <div class="notes-stats" id="idNotesStats">
              <span id="idWordCount">0 words</span>
              <span class="stats-divider">•</span>
              <span id="idCharCount">0 characters</span>
              <span class="stats-divider">•</span>
              <span id="idReadTime">0 min read</span>
            </div>
            <button class="notes-btn-save" id="btnSaveClose">Save & Close</button>
          </div>
        </div>

        <div class="notes-export-menu" id="idExportMenu" style="display: none;">
          <button data-export="markdown-file"><i class="material-icons">description</i> Export as Markdown (.md)</button>
          <button data-export="text-file"><i class="material-icons">article</i> Export as Text (.txt)</button>
          <button data-export="pdf-file"><i class="material-icons">picture_as_pdf</i> Export as PDF</button>
          <div class="export-divider"></div>
          <button data-export="copy-markdown"><i class="material-icons">content_copy</i> Copy as Markdown</button>
          <button data-export="copy-text"><i class="material-icons">content_paste</i> Copy as Plain Text</button>
        </div>
      `;
    }

    setupElements() {
        this.textarea = document.getElementById("idNotesTextarea");
        this.syntaxLayer = document.getElementById("idSyntaxLayer");
        this.preview = document.getElementById("idNotesPreview");
        this.paneEditor = document.getElementById("paneEditor");
        this.panePreview = document.getElementById("panePreview");
        this.textSelection = new TextSelection(this.textarea);

        this.highlighter = new SyntaxHighlighter();
        this.highlight(); // Initial highlight

        // Initialize Scroll Sync
        this.scrollSync = new ScrollSyncManager(this.textarea, this.preview);
        this.scrollSync.init(this.cleanupManager);

        // Sync syntax layer scroll
        this.cleanupManager.addEventListener(this.textarea, 'scroll', () => {
            if (this.syntaxLayer) {
                this.syntaxLayer.scrollTop = this.textarea.scrollTop;
                this.syntaxLayer.scrollLeft = this.textarea.scrollLeft;
            }
        });
    }

    highlight() {
        if (this.syntaxLayer && this.textarea) {
            this.syntaxLayer.innerHTML = this.highlighter.highlight(this.textarea.value);
        }
    }

    setupAutoSave() {
        this.autoSave = new EditorAutoSave(this, 2000);
        const statusElement = document.getElementById("idSaveStatus");
        this.autoSave.setStatusElement(statusElement);
    }

    setupEventListeners() {
        const debouncedUpdate = debounce(() => {
            this.updatePreview();
            // Re-sync after render if editor is active
            if (this.scrollSync && this.lastActiveElement === this.textarea) {
                this.scrollSync.forceSync();
            }
        }, 300);

        this.cleanupManager.addEventListener(this.textarea, 'input', () => {
            this.highlight(); // Instant syntax highlight
            debouncedUpdate();
            this.autoSave.markDirty();
            this.updateStats();
        });

        // View toggles
        this.cleanupManager.addEventListener(document.getElementById('btnViewEditor'), 'click', () => this.setView('editor'));
        this.cleanupManager.addEventListener(document.getElementById('btnViewSplit'), 'click', () => this.setView('split'));
        this.cleanupManager.addEventListener(document.getElementById('btnViewPreview'), 'click', () => this.setView('preview'));

        // Toolbar actions
        const toolbarButtons = this.dialog.querySelectorAll('.notes-toolbar [data-action]');
        toolbarButtons.forEach(btn => {
            this.cleanupManager.addEventListener(btn, 'click', (e) => {
                e.preventDefault();
                this.handleToolbarAction(btn.getAttribute('data-action'));
            });
            this.cleanupManager.addEventListener(btn, 'mousedown', (e) => e.preventDefault());
        });

        // Paste handler for images
        const handlePaste = (e) => this.handlePaste(e);
        this.cleanupManager.addEventListener(this.textarea, 'paste', handlePaste);
        this.cleanupManager.addEventListener(this.preview, 'paste', handlePaste);

        // Track active element
        this.cleanupManager.addEventListener(this.textarea, 'focus', () => this.lastActiveElement = this.textarea);
        this.cleanupManager.addEventListener(this.preview, 'focusin', (e) => this.lastActiveElement = e.target);

        // Checkbox interactions
        this.cleanupManager.addEventListener(this.preview, 'change', (e) => this.handleCheckboxChange(e));

        // Edit-in-preview sync
        this.cleanupManager.addEventListener(this.preview, 'input', (e) => this.handlePreviewEdit(e));

        // Enter key in preview
        this.cleanupManager.addEventListener(this.preview, 'keydown', (e) => this.handlePreviewKeydown(e));

        // Save and close
        this.cleanupManager.addEventListener(document.getElementById('btnSaveClose'), 'click', () => this.saveAndClose());

        // Close on escape
        this.cleanupManager.addEventListener(this.dialog, 'keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.saveAndClose();
            }
        });

        // Keyboard shortcuts
        this.cleanupManager.addEventListener(this.dialog, 'keydown', (e) => this.handleKeyboardShortcuts(e));

        // Click outside to close
        this.cleanupManager.addEventListener(this.dialog, 'click', (e) => {
            if (e.target === this.dialog) {
                this.saveAndClose();
            }
        });

        // Export menu
        this.setupExportMenu();
    }

    setupExportMenu() {
        const exportBtn = document.getElementById('btnExport');
        const exportMenu = document.getElementById('idExportMenu');

        this.cleanupManager.addEventListener(exportBtn, 'click', (e) => {
            e.stopPropagation();
            exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
        });

        // Close menu when clicking outside
        this.cleanupManager.addEventListener(document, 'click', () => {
            exportMenu.style.display = 'none';
        });

        // Export actions
        const exportButtons = exportMenu.querySelectorAll('[data-export]');
        exportButtons.forEach(btn => {
            this.cleanupManager.addEventListener(btn, 'click', (e) => {
                e.stopPropagation();
                this.handleExport(btn.getAttribute('data-export'));
                exportMenu.style.display = 'none';
            });
        });
    }

    setView(view) {
        this.currentView = view;
        document.querySelectorAll('.notes-toggle-btn').forEach(b => b.classList.remove('active'));
        this.paneEditor.classList.remove('hidden');
        this.panePreview.classList.remove('hidden');

        if (view === 'editor') {
            this.panePreview.classList.add('hidden');
            document.getElementById('btnViewEditor').classList.add('active');
        } else if (view === 'preview') {
            this.paneEditor.classList.add('hidden');
            document.getElementById('btnViewPreview').classList.add('active');
        } else {
            document.getElementById('btnViewSplit').classList.add('active');
        }
    }

    async updatePreview() {
        try {
            const scrollPos = this.preview.scrollTop;
            this.preview.innerHTML = this.parser.parse(this.textarea.value);
            this.preview.scrollTop = scrollPos;
            await this.resolveImages();
            this.updateStats(); // Ensure stats are updated on preview refresh too
        } catch (error) {
            console.error('Preview update failed:', error);
        }
    }

    updateStats() {
        const text = this.textarea.value.trim();
        const words = text ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const readTime = Math.ceil(words / 200);

        const wordCountEl = document.getElementById('idWordCount');
        const charCountEl = document.getElementById('idCharCount');
        const readTimeEl = document.getElementById('idReadTime');

        if (wordCountEl) wordCountEl.textContent = `${words} words`;
        if (charCountEl) charCountEl.textContent = `${chars} characters`;
        if (readTimeEl) readTimeEl.textContent = `${readTime} min read`;
    }

    async resolveImages() {
        const images = this.preview.querySelectorAll('img[data-img-id]');

        for (const img of images) {
            const id = img.getAttribute('data-img-id');

            // Use lazy loading for better performance
            this.lazyImageLoader.observe(img, async (imgElement) => {
                try {
                    const blob = await this.imageStorage.getImage(id);
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        imgElement.src = url;
                        this.cleanupManager.addBlobUrl(url);
                    }
                } catch (error) {
                    console.error(`Failed to load image ${id}:`, error);
                    // Set a placeholder or error state
                    imgElement.alt = 'Image failed to load';
                }
            });
        }
    }

    handleToolbarAction(action) {
        if (this.lastActiveElement === this.textarea) {
            this.textarea.focus();

            switch (action) {
                case 'bold':
                    this.insertMarkdown('**', '**');
                    break;
                case 'italic':
                    this.insertMarkdown('*', '*');
                    break;
                case 'underline':
                    this.insertMarkdown('<u>', '</u>');
                    break;
                case 'strikethrough':
                    this.insertMarkdown('~~', '~~');
                    break;
                case 'code':
                    this.insertMarkdown('`', '`');
                    break;
                case 'header1':
                    this.insertMarkdown('# ', '');
                    break;
                case 'header2':
                    this.insertMarkdown('## ', '');
                    break;
                case 'header3':
                    this.insertMarkdown('### ', '');
                    break;
                case 'link':
                    this.insertLink();
                    break;
                case 'list':
                    this.insertMarkdown('- ', '');
                    break;
                case 'task':
                    this.insertMarkdown('[ ] ', '');
                    break;
                case 'hr':
                    this.insertMarkdown('\n---\n', '');
                    break;
                case 'undo':
                case 'redo':
                    // These would need a custom undo/redo stack
                    // For now, rely on browser default
                    break;
            }
        } else {
            // Preview is active - use execCommand for contenteditable
            // Note: document.execCommand is deprecated but still the only way for contenteditable
            // without complex custom selection logic.
            this.lastActiveElement.focus();

            let cmd = '';
            let val = null;

            switch (action) {
                case 'bold': cmd = 'bold'; break;
                case 'italic': cmd = 'italic'; break;
                case 'underline': cmd = 'underline'; break;
                case 'strikethrough': cmd = 'strikeThrough'; break;
                case 'list': cmd = 'insertUnorderedList'; break;
                case 'hr': cmd = 'insertHorizontalRule'; break;

                // Smart toggles for headers
                case 'header1':
                    val = document.queryCommandValue('formatBlock') === 'h1' ? 'div' : 'H1';
                    cmd = 'formatBlock';
                    break;
                case 'header2':
                    val = document.queryCommandValue('formatBlock') === 'h2' ? 'div' : 'H2';
                    cmd = 'formatBlock';
                    break;
                case 'header3':
                    val = document.queryCommandValue('formatBlock') === 'h3' ? 'div' : 'H3';
                    cmd = 'formatBlock';
                    break;

                case 'code':
                    // Inline code toggle
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        const parent = range.commonAncestorContainer.nodeType === 3 ?
                            range.commonAncestorContainer.parentElement :
                            range.commonAncestorContainer;

                        if (parent.closest('code')) {
                            // Already code - unwrap (simplified approach)
                            // A robust unwrap is complex, simplified: just remove formatting
                            document.execCommand('removeFormat', false, null);
                            cmd = null;
                        } else {
                            if (selection.toString()) {
                                document.execCommand('insertHTML', false, `<code>${selection.toString()}</code>`);
                            } else {
                                document.execCommand('insertHTML', false, `<code>code</code>`);
                            }
                            cmd = null;
                        }
                    }
                    break;

                case 'link':
                    const selectionLink = window.getSelection().anchorNode.parentElement.closest('a');
                    if (selectionLink) {
                        cmd = 'unlink';
                    } else {
                        const url = prompt("Enter URL:", "https://");
                        if (url) {
                            cmd = 'createLink';
                            val = url;
                        }
                    }
                    break;

                case 'task':
                    // Insert actual checkbox input which parser understands
                    document.execCommand('insertHTML', false, '<input type="checkbox"> ');
                    cmd = null;
                    break;

                default:
                    console.log('Action not supported in preview mode:', action);
                    return;
            }

            if (cmd) {
                document.execCommand(cmd, false, val);
            }

            // Trigger input event to sync back to markdown
            this.lastActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    insertMarkdown(before, after) {
        const b = before.replace(/\\n/g, '\n');
        const a = after.replace(/\\n/g, '\n');
        this.textarea.focus();

        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const text = this.textarea.value;
        const selectedText = text.substring(start, end);

        // Heading Toggle Logic
        if (b.startsWith('#')) {
            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = text.indexOf('\n', start);
            const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
            const lineContent = text.substring(lineStart, actualLineEnd);

            if (lineContent.startsWith(b)) {
                // Toggle off
                this.textarea.setSelectionRange(lineStart, lineStart + b.length);
                this.textarea.setRangeText("", lineStart, lineStart + b.length, 'end');
            } else {
                // Replace or add
                const headingMatch = lineContent.match(/^#+\s/);
                if (headingMatch) {
                    this.textarea.setSelectionRange(lineStart, lineStart + headingMatch[0].length);
                    this.textarea.setRangeText(b, lineStart, lineStart + headingMatch[0].length, 'end');
                } else {
                    this.textarea.setSelectionRange(lineStart, lineStart);
                    this.textarea.setRangeText(b, lineStart, lineStart, 'end');
                }
            }
            this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        // Standard Wrapping Toggle Logic
        if (selectedText.startsWith(b) && selectedText.endsWith(a)) {
            // Unwrap
            const innerText = selectedText.substring(b.length, selectedText.length - a.length);
            this.textarea.setRangeText(innerText, start, end, 'end');
            this.textarea.setSelectionRange(start, start + innerText.length);
        } else {
            const outerBefore = text.substring(start - b.length, start);
            const outerAfter = text.substring(end, end + a.length);

            if (outerBefore === b && outerAfter === a) {
                // Unwrap from outside
                this.textarea.setRangeText(selectedText, start - b.length, end + a.length, 'end');
                this.textarea.setSelectionRange(start - b.length, start - b.length + selectedText.length);
            } else {
                // Wrap
                this.textarea.setRangeText(b + selectedText + a, start, end, 'end');
                if (selectedText.length > 0) {
                    this.textarea.setSelectionRange(start + b.length, end + b.length);
                } else {
                    this.textarea.setSelectionRange(start + b.length, start + b.length);
                }
            }
        }

        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insertLink() {
        const url = prompt("Enter URL:", "https://");
        if (url) {
            this.insertMarkdown("[", `](${url})`);
        }
    }

    async handlePaste(e) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                const id = 'img_' + Date.now();

                await this.imageStorage.saveImage(id, blob, {
                    altText: 'screenshot',
                    taskIndex: this.taskIndex
                });

                const mdRef = `![screenshot](tf-img://${id})`;
                if (this.lastActiveElement === this.textarea) {
                    this.insertMarkdown(mdRef, "");
                } else {
                    // Insert at cursor in preview
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode(mdRef));
                    }
                }
                await this.updatePreview();
            }
        }
    }

    handleCheckboxChange(e) {
        if (e.target.type === 'checkbox') {
            const isChecked = e.target.checked;
            const indexInList = Array.from(this.preview.querySelectorAll('input[type="checkbox"]')).indexOf(e.target);

            let checkboxCount = 0;
            const newText = this.textarea.value.split('\n').map(line => {
                return line.replace(/\[[ x]\]/g, (match) => {
                    if (checkboxCount === indexInList) {
                        checkboxCount++;
                        return isChecked ? '[x]' : '[ ]';
                    }
                    checkboxCount++;
                    return match;
                });
            }).join('\n');

            this.textarea.value = newText;
            this.autoSave.markDirty();
        }
    }

    handlePreviewEdit(e) {
        const target = e.target.closest('[data-line]'); // Ensure we get the container
        if (!target) return;

        const lineIdx = parseInt(target.getAttribute('data-line'), 10);
        if (!isNaN(lineIdx)) {
            const lines = this.textarea.value.split('\n');
            let htmlToMd = this.htmlConverter.convert(target.innerHTML);

            // Reconstruct the markdown line prefix if needed
            let prefix = "";
            const rawLine = lines[lineIdx] ? lines[lineIdx] : ""; // Handle undefined if new line
            if (rawLine.startsWith('# ')) prefix = "# ";
            else if (rawLine.startsWith('## ')) prefix = "## ";
            else if (rawLine.startsWith('### ')) prefix = "### ";
            else if (rawLine.startsWith('- [ ] ')) prefix = "- [ ] ";
            else if (rawLine.startsWith('- [x] ')) prefix = "- [x] ";
            else if (rawLine.startsWith('- ')) prefix = "- ";
            else if (rawLine.startsWith('* ')) prefix = "* ";
            // Handle quotes and other prefixes
            else if (rawLine.startsWith('> ')) prefix = "> ";

            // Check if conversion already includes prefix to avoid duplication if user typed it
            if (htmlToMd.startsWith(prefix.trim())) {
                prefix = "";
            }

            lines[lineIdx] = prefix + htmlToMd;
            this.textarea.value = lines.join('\n');

            // Sync syntax highlighter
            this.highlight();

            this.autoSave.markDirty();
        }
    }

    handlePreviewKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            const block = e.target.closest('[data-line]');
            if (!block) return;

            e.preventDefault();
            const lineIdx = parseInt(block.getAttribute('data-line'));
            const lines = this.textarea.value.split('\n');

            lines.splice(lineIdx + 1, 0, "");
            this.textarea.value = lines.join('\n');

            this.updatePreview().then(() => {
                const newBlock = this.preview.querySelector(`[data-line="${lineIdx + 1}"]`);
                if (newBlock) {
                    newBlock.focus();
                    const sel = window.getSelection();
                    const ran = document.createRange();
                    if (newBlock.firstChild) {
                        ran.setStart(newBlock.firstChild, 0);
                    } else {
                        ran.setStart(newBlock, 0);
                    }
                    ran.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(ran);
                }
            });
        }
    }

    handleKeyboardShortcuts(e) {
        if (!e.ctrlKey) return;

        let handled = true;
        switch (e.key.toLowerCase()) {
            case 'b': this.handleToolbarAction('bold'); break;
            case 'i': this.handleToolbarAction('italic'); break;
            case 'u': this.handleToolbarAction('underline'); break;
            case 'z': this.handleToolbarAction('undo'); break;
            case 'y': this.handleToolbarAction('redo'); break;
            default: handled = false;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    updateStats() {
        const text = this.textarea.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const readTime = Math.ceil(words / 200); // 200 WPM average

        document.getElementById('idWordCount').textContent = `${words} word${words !== 1 ? 's' : ''}`;
        document.getElementById('idCharCount').textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
        document.getElementById('idReadTime').textContent = `${readTime} min read`;
    }

    async handleExport(type) {
        const content = this.textarea.value;
        const taskTitle = this.task.title.replace(/[^a-z0-9]/gi, '_');

        try {
            switch (type) {
                case 'markdown-file':
                    this.downloadFile(content, `${taskTitle}.md`, 'text/markdown');
                    break;
                case 'text-file':
                    const plainText = this.convertToPlainText(content);
                    this.downloadFile(plainText, `${taskTitle}.txt`, 'text/plain');
                    break;
                case 'pdf-file':
                    await this.exportToPDF();
                    break;
                case 'copy-markdown':
                    await navigator.clipboard.writeText(content);
                    this.showToast('Copied as Markdown');
                    break;
                case 'copy-text':
                    const plainTextCopy = this.convertToPlainText(content);
                    await navigator.clipboard.writeText(plainTextCopy);
                    this.showToast('Copied as Plain Text');
                    break;
            }
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed', 'error');
        }
    }

    convertToPlainText(markdown) {
        // Remove markdown syntax for plain text
        return markdown
            .replace(/!\[.*?\]\(.*?\)/g, '[Image]')  // Images
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')      // Links
            .replace(/[*_~`#]/g, '')                 // Formatting
            .replace(/^[-*]\s/gm, '• ')              // Lists
            .replace(/^\d+\.\s/gm, '')               // Numbered lists
            .replace(/^>\s/gm, '')                   // Blockquotes
            .replace(/^---$/gm, '─'.repeat(40))      // HR
            .replace(/<\/?u>/g, '');                 // Underline tags
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast(`Downloaded ${filename}`);
    }

    async exportToPDF() {
        // Would need jsPDF library - placeholder for now
        this.showToast('PDF export requires jsPDF library', 'info');

        // TODO: Integrate jsPDF
        // const { jsPDF } = window.jspdf;
        // const doc = new jsPDF();
        // doc.text(this.convertToPlainText(this.textarea.value), 10, 10);
        // doc.save(`${this.task.title}.pdf`);
    }

    showToast(message, type = 'success') {
        // Use global showToast if available
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    async save() {
        try {
            data[this.taskIndex].notes = this.textarea.value;
            data[this.taskIndex].date_updated = new Date().toISOString();
            localStorage.setItem("data", JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Save failed:', error);
            throw error;
        }
    }

    async saveAndClose() {
        try {
            await this.save();
            this.close();
            createPost(); // Re-render main view
        } catch (error) {
            console.error('Save and close failed:', error);
        }
    }

    close() {
        // Cleanup
        this.cleanupManager.cleanup();
        if (this.autoSave) {
            this.autoSave.destroy();
        }
        if (this.lazyImageLoader) {
            this.lazyImageLoader.disconnect();
        }

        // Close and remove dialog
        if (this.dialog) {
            this.dialog.close();
            this.dialog.remove();
        }
    }
}

// ============================================================================
// GLOBAL FUNCTIONS (Backwards Compatibility)
// ============================================================================

// Global fullscreen image viewer
window.openFullscreenImage = (src) => {
    try {
        let overlay = document.getElementById('image-fullscreen-overlay');
        if (!overlay) {
            overlay = document.createElement('dialog');
            overlay.id = 'image-fullscreen-overlay';
            overlay.className = 'image-overlay';
            overlay.innerHTML = `
                <div class="image-container">
                    <img src="${src}" alt="Fullscreen image">
                    <button class="close-btn" aria-label="Close image" onclick="this.closest('dialog').close()">×</button>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.close();
            });
        } else {
            overlay.querySelector('img').src = src;
        }
        overlay.showModal();
    } catch (error) {
        console.error('Failed to open fullscreen image:', error);
    }
};

// Main entry point - creates new editor instance
function clkOpenTaskNotes(index) {
    const task = data[index];
    if (!task) return;

    const editor = new MarkdownEditor(index, task);
    editor.open().catch(error => {
        console.error('Failed to open notes editor:', error);
        if (typeof showToast === 'function') {
            showToast('Failed to open notes editor', 'error');
        }
    });
}

// Global Note Tag Handler
window.clkNoteTag = function (type) {
    const messages = {
        'action': 'Action function coming soon',
        'finding': 'Finding/Insight details coming soon',
        'documentation': 'Link to documentation coming soon',
        'question': 'Question/Blocker details coming soon'
    };
    if (typeof showToast === 'function') {
        showToast(messages[type] || "Tag clicked", "info");
    }
};

// Legacy compatibility functions (can be removed later)
function parseMarkdown(text) {
    const parser = new MarkdownParser();
    return parser.parse(text);
}

async function initImageDB() {
    const storage = new ImageStorage();
    await storage.init();
    return storage;
}

async function saveImageToDB(id, blob) {
    const storage = new ImageStorage();
    await storage.saveImage(id, blob);
}

async function getImageFromDB(id) {
    const storage = new ImageStorage();
    return await storage.getImage(id);
}
