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
