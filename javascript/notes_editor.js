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
            // Handle overloaded signature: saveImage(blob, metadata)
            if (id instanceof Blob) {
                metadata = blob || {};
                blob = id;
                id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }

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

                transaction.oncomplete = () => resolve(id);
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
                .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u>$1</u>')
                .replace(/~~(.*?)~~/g, '<strike>$1</strike>')
                .replace(/~(.*?)~/g, '<sub>$1</sub>')
                .replace(/\^(.*?)\^/g, '<sup>$1</sup>')
                .replace(/\$(.*?)\$/g, '<span class="md-math">$1</span>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\[ \]/g, '<input type="checkbox" aria-label="Task item">')
                .replace(/\[x\]/g, '<input type="checkbox" checked aria-label="Completed task">')
                .replace(/-a-/gi, '<span class="note-tag action" contenteditable="false" role="button" tabindex="0" aria-label="Action tag" onclick="clkNoteTag(\'action\')">action</span>')
                .replace(/-f-/gi, '<span class="note-tag finding" contenteditable="false" role="button" tabindex="0" aria-label="Finding tag" onclick="clkNoteTag(\'finding\')">finding</span>')
                .replace(/-d-/gi, '<span class="note-tag documentation" contenteditable="false" role="button" tabindex="0" aria-label="Documentation tag" onclick="clkNoteTag(\'documentation\')">documentation</span>')
                .replace(/-q-/gi, '<span class="note-tag question" contenteditable="false" role="button" tabindex="0" aria-label="Question tag" onclick="clkNoteTag(\'question\')">question</span>')
                .replace(/!\[(.*?)\]\(tf-img:\/\/(.*?)\)/g, '<img class="pasted-image" alt="$1" data-img-id="$2" onclick="openFullscreenImage(this.src)" loading="lazy">')
                .replace(/\[\^(.*?)\]/g, '<sup class="footnote-ref"><a href="#fn-$1" id="fnref-$1">$1</a></sup>')
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                .replace(/(^|[^"'])(https?:\/\/[^\s\)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
        };

        const footnotes = [];

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

            // Footnote definitions [^1]: Text
            const fnMatch = line.match(/^\[\^(.*?)\]:\s+(.*)$/);
            if (fnMatch) {
                footnotes.push({ id: fnMatch[1], text: fnMatch[2], index: i });
                continue;
            }

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
                htmlResult.push(escapeHtml(line) + '\n');
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
            // Lists & Task Lists (Support indentation)
            else if (line.match(/^(\s*)([-*])\s/)) {
                const match = line.match(/^(\s*)([-*])\s/);
                const indent = match[1].length;

                if (!inList) {
                    htmlResult.push('<ul class="markdown-list">');
                    inList = true;
                }

                const isTask = rawLine.includes('[ ]') || rawLine.includes('[x]');
                const content = parseInline(line.substring(match[0].length));
                const style = indent > 0 ? `style="margin-left: ${indent * 10}px"` : "";

                htmlResult.push(`<li class="${isTask ? 'task-item' : ''}" contenteditable="true" data-line="${i}" ${style}>${content}</li>`);
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

        // Render Footnotes at bottom
        if (footnotes.length > 0) {
            htmlResult.push('<div class="markdown-footnotes"><hr><ol>');
            footnotes.forEach(fn => {
                htmlResult.push(`<li id="fn-${fn.id}">${parseInline(fn.text)} <a href="#fnref-${fn.id}" class="footnote-backref">↩</a></li>`);
            });
            htmlResult.push('</ol></div>');
        }

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
        // No specific rules setup needed for DOM traversal
    }

    convert(html, isFragment = false, skipBlockNewlines = false) {
        if (!html) return '';

        // Use browser DOM parser
        const div = document.createElement('div');
        div.innerHTML = html;

        this.skipBlockNewlines = skipBlockNewlines;
        let md = this.processNode(div);
        return isFragment ? md : md.trim();
    }

    processNode(node) {
        if (node.nodeType === 3) { // Text node
            // Escape special markdown characters if needed, mostly context dependent
            // For now return text content but collapse excessive whitespace
            return node.textContent; //.replace(/\s+/g, ' '); 
        }

        if (node.nodeType !== 1) return ''; // Skip comments etc.

        let content = '';

        // Process children first
        for (let i = 0; i < node.childNodes.length; i++) {
            content += this.processNode(node.childNodes[i]);
        }

        const tagName = node.tagName.toLowerCase();

        switch (tagName) {
            case 'div':
            case 'p':
                // Block elements add newlines if they have content or are forced
                if (this.skipBlockNewlines) return content;
                return content ? `\n${content}\n` : '';

            case 'br':
                return '\n';

            case 'h1': return `\n# ${content}\n`;
            case 'h2': return `\n## ${content}\n`;
            case 'h3': return `\n### ${content}\n`;
            case 'h4': return `\n#### ${content}\n`;

            case 'b':
            case 'strong':
                return content.trim() ? `**${content}**` : '';

            case 'i':
            case 'em':
                return content.trim() ? `*${content}*` : '';

            case 'u':
                return content.trim() ? `<u>${content}</u>` : '';

            case 'sub':
                return content.trim() ? `~${content}~` : '';

            case 'sup':
                return content.trim() ? `^${content}^` : '';

            case 's':
            case 'strike':
            case 'del':
                return content.trim() ? `~~${content}~~` : '';

            case 'span':
                // Check if it's a custom note tag
                if (node.classList.contains('note-tag')) {
                    if (node.classList.contains('action')) return '-a-';
                    if (node.classList.contains('finding')) return '-f-';
                    if (node.classList.contains('documentation')) return '-d-';
                    if (node.classList.contains('question')) return '-q-';
                }
                return content;

            case 'pre':
                // Code block handling
                const codeChild = node.querySelector('code');
                const rawCode = codeChild ? codeChild.textContent : node.textContent;
                // Preserve internal newlines and spaces, only remove trailing block breaks if any
                return `\n\`\`\`\n${rawCode}\n\`\`\`\n`;

            case 'code':
                // Inline code only if not inside pre (though processNode is recursive, 
                // we handle PRE separately above to avoid double wrapping)
                if (node.parentElement && node.parentElement.tagName === 'PRE') {
                    return content;
                }
                return content.trim() ? `\`${content}\`` : '';

            case 'a':
                const href = node.getAttribute('href');
                return href ? `[${content}](${href})` : content;

            case 'img':
                const alt = node.getAttribute('alt') || 'image';
                const src = node.getAttribute('data-img-id') ? `tf-img://${node.getAttribute('data-img-id')}` : node.getAttribute('src');
                return `![${alt}](${src})`;

            case 'input':
                if (node.type === 'checkbox') {
                    return node.checked ? '[x] ' : '[ ] ';
                }
                return '';

            case 'ul':
            case 'ol':
                // Lists are tricky with recursion since we need to know we are in a list for LI items
                // Current simple implementation: block separation
                return `\n${content}\n`;

            case 'li':
                // Check if it's a footnote item
                if (node.closest('.markdown-footnotes')) {
                    const id = node.id.replace('fn-', '');
                    // Remove backref link from content if possible, or just return basic
                    const cleanContent = content.replace(' ↩', '');
                    return `\n[^${id}]: ${cleanContent.trim()}\n`;
                }
                // Ideally check parent for OL/UL but simple dash works for now
                // Improvement: could pass context 'listType'
                const parent = node.parentElement;
                if (parent && parent.tagName === 'OL') {
                    // Start index not tracked easily in recursion without context, fallback to 1.
                    return `1. ${content}\n`;
                }
                return `- ${content}\n`;

            default:
                return content;
        }
    }
}

// ============================================================================
// HTML SANITIZER (Minimalist for XSS Protection)
// ============================================================================

class HtmlSanitizer {
    static sanitize(html) {
        const div = document.createElement('div');
        div.innerHTML = html;

        const walked = this.walk(div);
        return walked.innerHTML;
    }

    static walk(node) {
        const allowedTags = ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'code', 'pre', 'a', 'img', 'ul', 'ol', 'li', 'input', 'blockquote', 'hr', 'span', 'sub', 'sup'];
        const allowedAttrs = ['href', 'src', 'alt', 'title', 'class', 'id', 'type', 'checked', 'data-img-id', 'data-line', 'target', 'rel', 'onclick', 'contenteditable', 'role', 'tabindex', 'aria-label'];

        const elNodes = node.querySelectorAll('*');
        for (const el of elNodes) {
            // Remove unapproved tags
            if (!allowedTags.includes(el.tagName.toLowerCase())) {
                el.parentNode.removeChild(el);
                continue;
            }

            // Remove unapproved attributes
            for (let i = el.attributes.length - 1; i >= 0; i--) {
                const attr = el.attributes[i].name.toLowerCase();
                if (!allowedAttrs.includes(attr)) {
                    el.removeAttribute(attr);
                    continue;
                }

                // Basic URL/Event sanitization
                if (attr === 'href' || attr === 'src') {
                    const val = el.getAttribute(attr).trim().toLowerCase();
                    if (val.startsWith('javascript:') || val.startsWith('data:') && !val.startsWith('data:image/')) {
                        el.removeAttribute(attr);
                    }
                }

                // Only allow specific hardcoded onclick actions for custom tags
                if (attr === 'onclick') {
                    const val = el.getAttribute(attr);
                    if (!val.startsWith('clkNoteTag(') && !val.startsWith('openFullscreenImage(')) {
                        el.removeAttribute(attr);
                    }
                }
            }
        }
        return node;
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
            { pattern: /~(.*?)~/g, class: 'md-sub' },
            { pattern: /\^(.*?)\^/g, class: 'md-sup' },
            { pattern: /`(.*?)`/g, class: 'md-code' },
            { pattern: /!\[(.*?)\]\((.*?)\)/g, class: 'md-image' },
            { pattern: /\[(.*?)\]\((.*?)\)/g, class: 'md-link' },
            { pattern: /^[-*]\s/gm, class: 'md-list' },
            { pattern: /^>\s.*$/gm, class: 'md-quote' },
            { pattern: /^- \[([ x])\]/gm, class: 'md-task' },
            { pattern: /^---$/gm, class: 'md-hr' }
        ];
    }

    highlight(text, searchQuery = null, activeStart = -1) {
        let html = escapeHtml(text);

        // 1. Basic Markdown Highlighting
        this.rules.forEach(rule => {
            html = html.replace(rule.pattern, match => {
                return `<span class="${rule.class}">${match}</span>`;
            });
        });

        // 2. Search Highlighting (with Active Match Support)
        if (searchQuery && searchQuery.length > 0) {
            try {
                const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // We use a manual approach here to verify if the match roughly aligns with active selection.
                // Note: Since 'html' is already HTML-escaped and has span tags, indices won't match raw text exactly.
                // However, for visual highlighting purposes, we can try to wrap matches uniquely.

                // Better approach for precision:
                // We can't easily map raw text indices to the escaped HTML indices without a full parser.
                // BUT, since we just want to highlight the "current" one, and the user likely just searched for it...
                // We can use a simpler heuristic or just highlight all for now, but to do "active" properly requires
                // DOM manipulation or a more complex highlighter that rebuilds HTML from tokens.

                // Compromise: We will use a unique class for ALL matches (yellow), 
                // and if we find a match that starts EXACTLY at activeStart (in raw text), we try to flag it?
                // No, raw text index != HTML index.

                // Let's stick to global highlighting for now, but if we really want active style,
                // we can try to update the regex replacement loop to check indices?
                // No, because 'html' string grows as we replace.

                // Alternative: The syntax layer is just visual overlay. 
                // We can use the 'find-highlight' class.
                // To support 'active', we need to pass a specific index to highlighting? Only if we build it perfectly.

                // For this request, checking 'textarea.selectionStart' is unreliable against the HTML string 
                // because of the tags added by step 1.

                // SIMPLE SOLUTION for 'Active':
                // We can't reliably do it in this simple regex highlighter without a rewrite.
                // However, users usually just want to see where they are. 
                // The textarea selection itself (blue background) shows the active one.
                // The yellow highlight shows ALL matches.
                // If we want a different color for the "current" one on top of the selection...

                // Let's try to do it by creating a specific regex for the active selection if it matches query?
                // No.

                // Given constraints, I will stick to the existing robust global highlight. 
                // To do 'active', we would need to know the 'occurrence index' (e.g. "match 3 of 5").

                // Wait, we can do this:
                // 1. Find all matches in raw text. determine which one includes activeStart.
                // 2. That gives us "Match #3 is active".
                // 3. In the HTML replacement loop, we count matches and style #3 differently.

                // Let's do that!

                // 1. Find active match index in raw text
                let activeMatchIndex = -1;
                if (activeStart !== -1) {
                    const regexRaw = new RegExp(escapedQuery, 'gi');
                    let match;
                    let count = 0;
                    while ((match = regexRaw.exec(text)) !== null) {
                        if (activeStart >= match.index && activeStart <= match.index + match[0].length) {
                            activeMatchIndex = count;
                            break;
                        }
                        count++;
                    }
                }

                // 2. Replace in HTML
                const regexHTML = new RegExp(`(${escapedQuery})(?![^<]*>)`, 'gi');
                let matchCount = 0;
                html = html.replace(regexHTML, (match, p1) => {
                    const isGroup = matchCount === activeMatchIndex;
                    matchCount++;
                    const cls = isGroup ? 'find-highlight-active' : 'find-highlight';
                    return `<span class="${cls}">${p1}</span>`;
                });

            } catch (e) {
                console.warn('Invalid regex in search highlight', e);
            }
        }

        // Handle trailing newlines for pre-wrap alignment
        if (text.endsWith('\n')) {
            html += ' ';
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
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;
        this.isActionInProgress = false;
    }

    async open() {
        try {
            // Check if this specific task's note is already open
            const existing = document.getElementById(`idNotesModal_${this.taskIndex}`);
            if (existing) {
                // If it's minimized, restore it. Otherwise just focus it.
                if (existing.classList.contains('minimized')) {
                    this.dialog = existing;
                    this.toggleMinimize();
                }
                existing.focus();
                return;
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

            // Push initial state to undo stack
            this.saveToHistory();

            // Show as non-modal to allow multitasking and preserve app interaction
            this.dialog.show();

            // Check for high contrast
            this.applyAccessibilityPreferences();

            // Focus textarea
            this.textarea.focus();
        } catch (error) {
            console.error('Failed to open editor:', error);
            throw error;
        }
    }

    createDialog() {
        this.dialog = document.createElement("dialog");
        this.dialog.id = `idNotesModal_${this.taskIndex}`;
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
              <div class="notes-header-tags">
                  ${(this.task.tags || []).map(tag => `<span class="note-tag">${tag}</span>`).join('')}
              </div>
            </div>
            <div class="notes-header-right">
              <button class="notes-header-btn" id="btnExportNotes" aria-label="Export options" title="Export">
                <i class="material-icons">file_download</i>
              </button>
              <button class="notes-header-btn" id="btnMinimiseNotes" aria-label="Minimise" title="Minimise">
                <i class="material-icons">remove</i>
              </button>
              <button class="notes-header-btn" id="btnMaximiseNotes" aria-label="Maximise" title="Maximise">
                <i class="material-icons">open_in_full</i>
              </button>
              <button class="notes-header-btn btn-close-notes" id="btnCloseNotes" aria-label="Close" title="Close">
                <i class="material-icons">close</i>
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
            <i class="material-icons" title="Subscript" tabindex="0" role="button" aria-label="Subscript" data-action="subscript">subscript</i>
            <i class="material-icons" title="Superscript" tabindex="0" role="button" aria-label="Superscript" data-action="superscript">superscript</i>
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
            <div class="notes-toolbar-divider"></div>
            <button class="notes-export-btn" title="Search (Ctrl+F)" tabindex="0" role="button" aria-label="Search" data-action="search" style="padding: 0; background: none; border: none; color: inherit; cursor: pointer; display: flex; align-items: center;">
              <i class="material-icons">search</i>
            </button>
            <button class="notes-export-btn" title="Help/Shortcuts (Ctrl+H)" tabindex="0" role="button" aria-label="Help" data-action="help" style="padding: 0; background: none; border: none; color: inherit; cursor: pointer; display: flex; align-items: center; margin-left: 4px;">
              <i class="material-icons">help_outline</i>
            </button>
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
            
            <div class="notes-view-toggle" id="idFooterViewToggle">
              <button class="notes-toggle-btn" id="btnViewEditor" aria-label="Editor only view">Editor</button>
              <button class="notes-toggle-btn active" id="btnViewSplit" aria-label="Split view">Split</button>
              <button class="notes-toggle-btn" id="btnViewPreview" aria-label="Preview only view">Preview</button>
            </div>
            <div class="notes-save-status" id="idSaveStatus" role="button" tabindex="0" aria-label="Auto-save information" title="Click for auto-save info">
              <i class="material-icons">check_circle</i>
              <span>Saved</span>
            </div>
          </div>
        </div>

        <div class="notes-export-menu" id="idExportMenu" style="display: none;">
          <button data-export="markdown-file">
            <i class="material-icons" style="font-size: 20px; margin-right: 8px;">description</i>
            Export as Markdown (.md)
          </button>
          <button data-export="text-file">
            <i class="material-icons" style="font-size: 20px; margin-right: 8px;">description</i>
            Export as Text (.txt)
          </button>
          <button data-export="pdf-file">
            <i class="material-icons" style="font-size: 20px; margin-right: 8px;">picture_as_pdf</i>
            Export as PDF
          </button>
          <div class="export-divider"></div>
            <button data-export="copy-markdown">
                <i class="material-icons" style="font-size: 20px; margin-right: 8px;">content_copy</i>
                Copy as Markdown
            </button>
            <button data-export="copy-text">
                <i class="material-icons" style="font-size: 20px; margin-right: 8px;">content_paste</i>
                Copy as Plain Text
            </button>
          </div>
          
          <div class="notes-search-panel" id="idSearchPanel" style="display: none;">
            <input type="text" id="idSearchInput" placeholder="Find...">
            <button class="notes-search-btn" id="btnFindPrev" title="Previous"><i class="material-icons">expand_less</i></button>
            <button class="notes-search-btn" id="btnFindNext" title="Next"><i class="material-icons">expand_more</i></button>
            <div class="divider"></div>
            <input type="text" id="idReplaceInput" placeholder="Replace...">
            <button class="notes-search-btn" id="btnReplace" title="Replace"><i class="material-icons">find_replace</i></button>
            <button class="notes-search-btn" id="btnReplaceAll" title="Replace All"><i class="material-icons">done_all</i></button>
            <div class="divider"></div>
            <button class="notes-search-btn" id="btnCloseSearch" title="Close"><i class="material-icons">close</i></button>
          </div>
        `;
    }

    setupElements() {
        this.textarea = this.dialog.querySelector("#idNotesTextarea");
        this.syntaxLayer = this.dialog.querySelector("#idSyntaxLayer");
        this.preview = this.dialog.querySelector("#idNotesPreview");
        this.paneEditor = this.dialog.querySelector("#paneEditor");
        this.panePreview = this.dialog.querySelector("#panePreview");
        this.textSelection = new TextSelection(this.textarea);

        // Phase 4: Each block has contentEditable="true", container should not
        // to avoid event target ambiguity and browser-inserted generic divs.
        this.preview.contentEditable = "false";
        this.preview.spellcheck = true;

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
            const searchInput = this.dialog.querySelector("#idSearchInput");
            const searchPanel = this.dialog.querySelector("#idSearchPanel");
            // Only highlight search terms if the panel is visible and input is active
            const query = (searchInput && searchPanel && searchPanel.style.display !== 'none') ? searchInput.value : null;

            this.syntaxLayer.innerHTML = this.highlighter.highlight(this.textarea.value, query, this.textarea.selectionStart);
        }
    }

    setupAutoSave() {
        this.autoSave = new EditorAutoSave(this, 2000);
        const statusElement = this.dialog.querySelector("#idSaveStatus");
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

        const debouncedSaveHistory = debounce(() => {
            if (this.textarea) this.saveToHistory();
        }, 1000);

        this.cleanupManager.addEventListener(this.textarea, 'input', () => {
            if (this.isActionInProgress) return; // Skip history save when we are setting value from code

            this.highlight(); // Instant syntax highlight

            // Only update preview if the user is not actively typing in it
            const isEditingInPreview = this.preview.contains(this.lastActiveElement);
            if (!isEditingInPreview) {
                debouncedUpdate();
            }

            debouncedSaveHistory();
            this.autoSave.markDirty();
            this.updateStats();
        });

        // View toggles
        this.cleanupManager.addEventListener(this.dialog.querySelector('#btnViewEditor'), 'click', () => this.setView('editor'));
        this.cleanupManager.addEventListener(this.dialog.querySelector('#btnViewSplit'), 'click', () => this.setView('split'));
        this.cleanupManager.addEventListener(this.dialog.querySelector('#btnViewPreview'), 'click', () => this.setView('preview'));

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
        this.cleanupManager.addEventListener(this.textarea, 'focus', () => {
            this.lastActiveElement = this.textarea;
            this.bringToFront();
        });
        this.cleanupManager.addEventListener(this.textarea, 'click', () => {
            this.highlight(); // Update active match highlight for markdown
            this.highlightPreviewSearch(); // Update active match highlight for preview
        });
        this.cleanupManager.addEventListener(this.textarea, 'keyup', () => {
            this.highlight();
            this.highlightPreviewSearch();
        });
        this.cleanupManager.addEventListener(this.preview, 'focusin', (e) => {
            this.lastActiveElement = e.target;
            this.bringToFront();
        });

        // Window resize listener for minimized notes centering
        this.cleanupManager.addEventListener(window, 'resize', () => {
            MarkdownEditor.updateMinimizedPositions();
        });

        // Checkbox interactions
        this.cleanupManager.addEventListener(this.preview, 'change', (e) => this.handleCheckboxChange(e));

        // Edit-in-preview sync
        this.cleanupManager.addEventListener(this.preview, 'input', (e) => this.handlePreviewEdit(e));

        // Minimise/Maximise
        const btnMin = this.dialog.querySelector('#btnMinimiseNotes');
        if (btnMin) {
            this.cleanupManager.addEventListener(btnMin, 'click', (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            });
        }
        const btnMax = this.dialog.querySelector('#btnMaximiseNotes');
        if (btnMax) {
            this.cleanupManager.addEventListener(btnMax, 'click', (e) => {
                e.stopPropagation();
                this.toggleMaximize();
            });
        }

        // Restore from minimized on header click
        this.cleanupManager.addEventListener(this.dialog.querySelector('.notes-header'), 'click', () => {
            if (this.dialog.classList.contains('minimized')) {
                this.toggleMinimize();
            }
        });

        // Enter key in preview
        this.cleanupManager.addEventListener(this.preview, 'keydown', (e) => this.handlePreviewKeydown(e));

        // Save status click handler - show auto-save info
        const saveStatus = this.dialog.querySelector('#idSaveStatus');
        if (saveStatus) {
            this.cleanupManager.addEventListener(saveStatus, 'click', () => this.showAutoSaveInfo());
            this.cleanupManager.addEventListener(saveStatus, 'keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.showAutoSaveInfo();
                }
            });
        }

        const btnHeaderClose = this.dialog.querySelector('#btnCloseNotes');
        if (btnHeaderClose) {
            this.cleanupManager.addEventListener(btnHeaderClose, 'click', () => this.saveAndClose());
        }

        // Close on escape
        this.cleanupManager.addEventListener(this.dialog, 'keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.saveAndClose();
            }
        });

        // Keyboard shortcuts
        this.cleanupManager.addEventListener(this.dialog, 'keydown', (e) => this.handleKeyboardShortcuts(e));

        // Click outside to close (or bring to front)
        this.cleanupManager.addEventListener(this.dialog, 'mousedown', () => {
            this.bringToFront();
        });

        this.cleanupManager.addEventListener(this.dialog, 'click', (e) => {
            if (e.target === this.dialog) {
                this.saveAndClose();
            }
        });

        // Export menu
        this.setupExportMenu();

        // Drag and drop
        this.setupDragAndDrop();

        // Search and replace
        this.setupSearch();
    }

    setupDragAndDrop() {
        const handleDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        try {
                            const compressedBlob = await this.imageStorage.compressImage(file);
                            const id = await this.imageStorage.saveImage(compressedBlob, {
                                altText: file.name,
                                taskIndex: this.taskIndex,
                                originalSize: file.size
                            });

                            // Insert markdown at cursor or end
                            const markdown = `![${file.name}](tf-img://${id})\n`;

                            // If dropped on preview, append to end. If on editor, insert at pos if possible?
                            // For simplicity, insert at current cursor pos in textarea
                            if (this.lastActiveElement === this.textarea) {
                                this.insertMarkdown(markdown, '');
                            } else {
                                // Append to end
                                this.textarea.value += '\n' + markdown;
                                this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                            }

                        } catch (error) {
                            console.error('Image upload failed:', error);
                            alert('Failed to upload image: ' + error.message);
                        }
                    }
                }
            }
        };

        ['dragenter', 'dragover', 'dragleave'].forEach(eventName => {
            this.cleanupManager.addEventListener(this.dialog, eventName, handleDrag);
        });

        this.cleanupManager.addEventListener(this.dialog, 'drop', handleDrop);
    }

    setupExportMenu() {
        const exportBtn = this.dialog.querySelector('#btnExportNotes');
        const exportMenu = this.dialog.querySelector('#idExportMenu');

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

    setupSearch() {
        const panel = this.dialog.querySelector('#idSearchPanel');
        const searchInput = this.dialog.querySelector('#idSearchInput');
        const replaceInput = this.dialog.querySelector('#idReplaceInput');
        const btnFindNext = this.dialog.querySelector('#btnFindNext');
        const btnFindPrev = this.dialog.querySelector('#btnFindPrev');
        const btnReplace = this.dialog.querySelector('#btnReplace');
        const btnReplaceAll = this.dialog.querySelector('#btnReplaceAll');
        const btnClose = this.dialog.querySelector('#btnCloseSearch');

        // Toggle search with Ctrl+F is already handled in global keydown

        // Close
        this.cleanupManager.addEventListener(btnClose, 'click', () => {
            panel.style.display = 'none';
            this.textarea.focus();
        });

        // Find Logic
        const find = (forward = true) => {
            const query = searchInput.value;
            if (!query) return;

            // Do not force focus to textarea here, focus will be handled contextually.
            // We want to keep typing/enter capability in search box.

            // Native find logic for textarea
            const text = this.textarea.value;
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;

            let index = -1;
            if (forward) {
                index = text.indexOf(query, end); // Search after current selection
                if (index === -1) index = text.indexOf(query, 0); // Wrap around
            } else {
                index = text.lastIndexOf(query, start - 1); // Search before current selection
                if (index === -1) index = text.lastIndexOf(query); // Wrap around
            }

            if (index !== -1) {
                this.textarea.setSelectionRange(index, index + query.length);
                // Scroll to selection (rudimentary)
                const lineHeight = 21; // approx
                const lineNo = text.substr(0, index).split('\n').length;
                this.textarea.scrollTop = (lineNo - 5) * lineHeight;

                // Update highlights (since selection doesn't trigger input event)
                this.highlight();
                this.highlightPreviewSearch();
            } else {
                // Not found
                searchInput.classList.add('error');
                setTimeout(() => searchInput.classList.remove('error'), 500);
            }
        };

        this.cleanupManager.addEventListener(btnFindNext, 'click', () => find(true));
        this.cleanupManager.addEventListener(btnFindPrev, 'click', () => find(false));
        this.cleanupManager.addEventListener(searchInput, 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                find(true);
            }
        });

        this.cleanupManager.addEventListener(searchInput, 'input', debounce(() => {
            this.highlight();
            this.highlightPreviewSearch();
        }, 150));

        // Replace Logic
        this.cleanupManager.addEventListener(btnReplace, 'click', () => {
            const query = searchInput.value;
            const replacement = replaceInput.value;
            if (!query) return;

            // Check if current selection matches query
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            const selected = this.textarea.value.substring(start, end);

            if (selected === query) {
                // Replace current
                this.textarea.setRangeText(replacement, start, end, 'select');
                this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                find(true); // Find next
            } else {
                find(true); // Find first then user clicks again to replace
            }
        });

        this.cleanupManager.addEventListener(btnReplaceAll, 'click', () => {
            const query = searchInput.value;
            const replacement = replaceInput.value;
            if (!query) return;

            const text = this.textarea.value;
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const newText = text.replace(regex, replacement);

            if (text !== newText) {
                this.textarea.value = newText;
                this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                alert('Replaced all occurrences.');
            }
        });
    }

    setView(view) {
        this.currentView = view;
        this.dialog.querySelectorAll('.notes-toggle-btn').forEach(b => b.classList.remove('active'));
        this.paneEditor.classList.remove('hidden');
        this.panePreview.classList.remove('hidden');

        if (view === 'editor') {
            this.panePreview.classList.add('hidden');
            this.dialog.querySelector('#btnViewEditor').classList.add('active');
        } else if (view === 'preview') {
            this.paneEditor.classList.add('hidden');
            this.dialog.querySelector('#btnViewPreview').classList.add('active');
        } else {
            this.dialog.querySelector('#btnViewSplit').classList.add('active');
        }
    }

    async updatePreview(forceLoad = false) {
        try {
            const scrollPos = this.preview.scrollTop;
            let html = this.parser.parse(this.textarea.value);

            // Phase 4: Add XSS protection
            html = HtmlSanitizer.sanitize(html);

            this.preview.innerHTML = html;
            this.preview.scrollTop = scrollPos;
            await this.resolveImages(forceLoad);
            this.highlightPreviewSearch(); // Add search highlighting to preview
            this.updateStats(); // Ensure stats are updated on preview refresh too
        } catch (error) {
            console.error('Preview update failed:', error);
        }
    }

    saveToHistory() {
        // Only save if content changed from top of stack
        const currentContent = this.textarea.value;
        if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1].content === currentContent) {
            return;
        }

        this.undoStack.push({
            content: currentContent,
            selectionStart: this.textarea.selectionStart,
            selectionEnd: this.textarea.selectionEnd
        });

        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }

        // Reset redo stack on new action
        this.redoStack = [];

        // Debug log (optional)
        // console.log("State saved to history. Undo Stack size:", this.undoStack.length);
    }

    handleUndoRedo(isUndo = true) {
        const stack = isUndo ? this.undoStack : this.redoStack;
        const otherStack = isUndo ? this.redoStack : this.undoStack;

        if (stack.length === 0) return;

        this.isActionInProgress = true;

        try {
            // Save current state to other stack before restoring
            otherStack.push({
                content: this.textarea.value,
                selectionStart: this.textarea.selectionStart,
                selectionEnd: this.textarea.selectionEnd
            });

            if (otherStack.length > this.maxStackSize) {
                otherStack.shift();
            }

            const state = stack.pop();
            this.textarea.value = state.content;
            this.textarea.setSelectionRange(state.selectionStart, state.selectionEnd);

            // Trigger sync
            this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
            this.textarea.focus();

            // Highlight and preview must be updated manually because we returned early in event listener
            this.highlight();
            this.updatePreview();
        } finally {
            this.isActionInProgress = false;
        }
    }

    updateStats() {
        const text = this.textarea.value.trim();
        const words = text ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const readTime = Math.ceil(words / 200);

        const wordCountEl = this.dialog.querySelector('#idWordCount');
        const charCountEl = this.dialog.querySelector('#idCharCount');
        const readTimeEl = this.dialog.querySelector('#idReadTime');

        if (wordCountEl) wordCountEl.textContent = `${words} words`;
        if (charCountEl) charCountEl.textContent = `${chars} characters`;
        if (readTimeEl) readTimeEl.textContent = `${readTime} min read`;
    }

    async resolveImages(forceLoad = false) {
        const images = this.preview.querySelectorAll('img[data-img-id]');
        const promises = [];

        for (const img of images) {
            const id = img.getAttribute('data-img-id');

            const loadTask = async (imgElement) => {
                try {
                    const blob = await this.imageStorage.getImage(id);
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        return new Promise((resolve) => {
                            imgElement.onload = () => resolve();
                            imgElement.onerror = () => resolve(); // Don't block if image fails
                            imgElement.src = url;
                            this.cleanupManager.addBlobUrl(url);
                        });
                    }
                } catch (error) {
                    console.error(`Failed to load image ${id}:`, error);
                }
            };

            if (forceLoad) {
                promises.push(loadTask(img));
            } else {
                // Use lazy loading for better performance
                this.lazyImageLoader.observe(img, loadTask);
            }
        }

        if (forceLoad && promises.length > 0) {
            await Promise.all(promises);
        }
    }

    highlightPreviewSearch() {
        const searchInput = this.dialog.querySelector('#idSearchInput');
        const searchPanel = this.dialog.querySelector('#idSearchPanel');
        if (!this.preview) return;

        // 1. ALWAYS clear existing highlights first
        const existing = this.preview.querySelectorAll('.find-highlight, .find-highlight-active');
        existing.forEach(el => {
            const textNode = document.createTextNode(el.textContent);
            el.parentNode.replaceChild(textNode, el);
        });
        this.preview.normalize();

        // 2. Only continue if search panel is visible and we have a query
        if (!searchInput || !searchPanel || searchPanel.style.display === 'none') {
            return;
        }

        const query = searchInput.value;
        if (!query || query.length === 0) {
            return;
        }

        // Determine which match is active based on textarea selection
        let activeMatchIndex = -1;
        const textareaText = this.textarea.value;
        const selectionStart = this.textarea.selectionStart;

        if (selectionStart !== -1) {
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            let match;
            let count = 0;
            while ((match = regex.exec(textareaText)) !== null) {
                // If cursor is within this match, this is the active one
                if (selectionStart >= match.index && selectionStart <= match.index + match[0].length) {
                    activeMatchIndex = count;
                    break;
                }
                count++;
            }
        }

        try {
            // Walk through all text nodes in the preview and highlight matches
            const walker = document.createTreeWalker(
                this.preview,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        // Skip if parent already has highlight class
                        if (node.parentElement.classList.contains('find-highlight') ||
                            node.parentElement.classList.contains('find-highlight-active')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        // Skip script and style elements
                        if (node.parentElement.tagName === 'SCRIPT' ||
                            node.parentElement.tagName === 'STYLE') {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );

            const nodesToProcess = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.toLowerCase().includes(query.toLowerCase())) {
                    nodesToProcess.push(node);
                }
            }

            // Track global match count across all nodes
            let globalMatchCount = 0;

            // Process nodes and add highlights
            nodesToProcess.forEach(textNode => {
                const text = textNode.textContent;
                const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const matches = text.match(regex);

                if (matches) {
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;

                    text.replace(regex, (match, p1, offset) => {
                        // Add text before match
                        if (offset > lastIndex) {
                            fragment.appendChild(document.createTextNode(text.substring(lastIndex, offset)));
                        }

                        // Add highlighted match
                        const span = document.createElement('span');
                        // Check if this is the active match
                        const isActive = globalMatchCount === activeMatchIndex;
                        span.className = isActive ? 'find-highlight-active' : 'find-highlight';
                        span.textContent = match;
                        fragment.appendChild(span);

                        globalMatchCount++;
                        lastIndex = offset + match.length;
                    });

                    // Add remaining text
                    if (lastIndex < text.length) {
                        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                    }

                    textNode.parentNode.replaceChild(fragment, textNode);
                }
            });

            // Scroll active match into view
            if (activeMatchIndex !== -1) {
                const activeHighlight = this.preview.querySelector('.find-highlight-active');
                if (activeHighlight) {
                    activeHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        } catch (error) {
            console.warn('Preview search highlighting failed:', error);
        }
    }

    handleToolbarAction(action) {
        // 1. Handle Global Meta Actions (don't require history save)
        if (action === 'search') {
            this.toggleSearchPanel();
            return;
        }
        if (action === 'help') {
            this.showHelpModal();
            return;
        }

        // 2. Save current state before formatting actions (except undo/redo themselves)
        if (action !== 'undo' && action !== 'redo') {
            this.saveToHistory();
        }

        if (this.lastActiveElement === this.textarea) {
            this.textarea.focus();

            switch (action) {
                case 'undo': this.handleUndoRedo(true); break;
                case 'redo': this.handleUndoRedo(false); break;
                case 'bold': this.insertMarkdown('**', '**'); break;
                case 'italic': this.insertMarkdown('*', '*'); break;
                case 'underline': this.insertMarkdown('<u>', '</u>'); break;
                case 'strikethrough': this.insertMarkdown('~~', '~~'); break;
                case 'subscript': this.insertMarkdown('~', '~'); break;
                case 'superscript': this.insertMarkdown('^', '^'); break;
                case 'code':
                    const start = this.textarea.selectionStart;
                    const end = this.textarea.selectionEnd;
                    const selected = this.textarea.value.substring(start, end);
                    const isNewBlock = selected.includes('\n') || this.isAtStartOfLine();

                    if (isNewBlock) {
                        this.insertMarkdown('```\n', '\n```');
                    } else {
                        this.insertMarkdown('`', '`');
                    }
                    break;
                case 'header1': this.insertMarkdown('# ', ''); break;
                case 'header2': this.insertMarkdown('## ', ''); break;
                case 'header3': this.insertMarkdown('### ', ''); break;
                case 'link': this.insertLink(); break;
                case 'list': this.insertMarkdown('- ', ''); break;
                case 'task': this.insertMarkdown('[ ] ', ''); break;
                case 'hr': this.insertMarkdown('\n---\n', ''); break;
                default:
                    console.warn('Action not recognized in textarea:', action);
                    break;
            }
        } else if (this.lastActiveElement && (this.lastActiveElement === this.preview || this.lastActiveElement.isContentEditable)) {
            this.applyFormatModern(action);
        }
    }

    applyFormatModern(action, val = null) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);

        switch (action) {
            case 'bold': this.wrapInTag(range, 'strong'); break;
            case 'italic': this.wrapInTag(range, 'em'); break;
            case 'underline': this.wrapInTag(range, 'u'); break;
            case 'strikethrough': this.wrapInTag(range, 'strike'); break;
            case 'subscript': this.wrapInTag(range, 'sub'); break;
            case 'superscript': this.wrapInTag(range, 'sup'); break;
            case 'code':
                // Smart select: if selection is multi-line or contains block elements, use code block
                if (selection.toString().includes('\n') || !range.collapsed && range.commonAncestorContainer.nodeType !== 3) {
                    this.applyBlockFormat(range, 'pre');
                } else {
                    this.wrapInTag(range, 'code');
                }
                break;
            case 'undo': this.handleUndoRedo(true); break;
            case 'redo': this.handleUndoRedo(false); break;
            case 'header1': this.applyBlockFormat(range, 'h1'); break;
            case 'header2': this.applyBlockFormat(range, 'h2'); break;
            case 'header3': this.applyBlockFormat(range, 'h3'); break;
            case 'link':
                const url = prompt("Enter URL:", "https://");
                if (url) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.appendChild(range.extractContents());
                    range.insertNode(a);
                }
                break;
            case 'list':
                this.applyBlockFormat(range, 'li');
                break;
            case 'task':
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                range.insertNode(cb);
                range.insertNode(document.createTextNode(' '));
                break;
            case 'hr':
                range.insertNode(document.createElement('hr'));
                break;
            default:
                console.warn('Formatting action not yet supported in modern mode:', action);
        }

        // Trigger sync back to markdown
        this.lastActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
    }

    wrapInTag(range, tagName) {
        if (range.collapsed) {
            const el = document.createElement(tagName);
            el.innerHTML = '&#8203;'; // Zero width space to allow typing
            range.insertNode(el);
            range.setStart(el, 1);
            range.collapse(true);
        } else {
            const content = range.extractContents();
            const el = document.createElement(tagName);
            el.appendChild(content);
            range.insertNode(el);
            // Re-select applied format
            const newRange = document.createRange();
            newRange.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    }

    applyBlockFormat(range, tagName) {
        let container = range.commonAncestorContainer;
        if (container.nodeType === 3) container = container.parentElement;

        // Find existing block element
        const block = container.closest('div, p, h1, h2, h3, h4, h5, h6, li');

        // Safety check: Don't replace the preview pane itself!
        if (block && this.preview.contains(block) && block !== this.preview) {
            const newBlock = document.createElement(tagName);
            if (tagName === 'pre') {
                newBlock.className = 'code-block';
                const codeInner = document.createElement('code');
                while (block.firstChild) {
                    codeInner.appendChild(block.firstChild);
                }
                newBlock.appendChild(codeInner);
            } else {
                while (block.firstChild) {
                    newBlock.appendChild(block.firstChild);
                }
            }

            block.parentNode.replaceChild(newBlock, block);

            // Select contents
            const newRange = document.createRange();
            newRange.selectNodeContents(newBlock);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else {
            // Case: cursor in text node directly in preview, or multiple nodes selected
            const newBlock = document.createElement(tagName);
            if (range.collapsed) {
                newBlock.innerHTML = '&#8203;';
                range.insertNode(newBlock);
                range.setStart(newBlock, 1);
                range.collapse(true);
            } else {
                newBlock.appendChild(range.extractContents());
                range.insertNode(newBlock);

                const newRange = document.createRange();
                newRange.selectNodeContents(newBlock);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
        }
    }

    insertMarkdown(before, after) {
        // Save history before change
        this.saveToHistory();

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
        } else {
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
        }

        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    isAtStartOfLine() {
        const pos = this.textarea.selectionStart;
        const text = this.textarea.value;
        if (pos === 0) return true;
        return text[pos - 1] === '\n';
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
        const node = e.target.nodeType === 3 ? e.target.parentElement : e.target;
        const target = node.closest('[data-line]');
        if (!target) return;

        const lineIdx = parseInt(target.getAttribute('data-line'), 10);
        if (isNaN(lineIdx)) return;

        const lines = this.textarea.value.split('\n');
        let htmlToMd = this.htmlConverter.convert(target.innerHTML, true, true);

        // Normalize spaces and non-breaking chars early to ensure accurate mapping/comparison
        htmlToMd = htmlToMd.replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ');

        // Robust structural prefix detection from source (indentation, bullets, quotes, headings)
        const oldLine = (lines[lineIdx] || "").replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ');
        const prefixMatch = oldLine.match(/^([#>\s\*-]*(\[[ x]\])?\s*)/);
        let prefix = prefixMatch ? prefixMatch[1] : "";

        // DEDUPLICATION: If the conversion already contains the prefix, don't add it again.
        // This handles cases where the browser includes leading spaces in paragraphs
        // or where formatting tags (like bold **) are at the start of a matched prefix.
        if (prefix && htmlToMd.startsWith(prefix)) {
            prefix = "";
        }

        const newLine = prefix + htmlToMd;

        if (lines[lineIdx] !== newLine) {
            lines[lineIdx] = newLine;
            this.textarea.value = lines.join('\n');

            // Immediate sync feedback for stats and syntax layer
            this.highlight();
            this.updateStats();
            this.autoSave.markDirty();

            this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    toggleSearchPanel() {
        const panel = this.dialog.querySelector('#idSearchPanel');
        const searchInput = this.dialog.querySelector('#idSearchInput');
        if (!panel || !searchInput) return;

        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'flex' : 'none';

        if (isHidden) {
            searchInput.focus();
            const selection = window.getSelection().toString();
            if (selection) {
                searchInput.value = selection;
            }
            this.highlight();
            this.highlightPreviewSearch();
        } else {
            this.textarea.focus();
            this.highlight();
            this.highlightPreviewSearch();
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
        // Toolbar Arrow Key Navigation
        if (e.target.closest('.notes-toolbar')) {
            const buttons = Array.from(this.dialog.querySelectorAll('.notes-toolbar [tabindex="0"]'));
            const index = buttons.indexOf(e.target);
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const nextIndex = e.key === 'ArrowRight'
                    ? (index + 1) % buttons.length
                    : (index - 1 + buttons.length) % buttons.length;
                buttons[nextIndex].focus();
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.target.click();
                return;
            }
        }

        if (!e.ctrlKey) return;

        let handled = true;
        const key = e.key.toLowerCase();

        // Standard shortcuts in editor
        if (key === 'b') this.handleToolbarAction('bold');
        else if (key === 'i') this.handleToolbarAction('italic');
        else if (key === 'u') this.handleToolbarAction('underline');
        else if (key === 'z') this.handleToolbarAction('undo');
        else if (key === 'y') this.handleToolbarAction('redo');
        else if (key === 'f') this.handleToolbarAction('search');
        else if (key === 'h') this.handleToolbarAction('help');
        else if (key === 's') { this.saveAndClose(); }
        else if (e.key === 'Enter') { this.saveAndClose(); }
        else handled = false;

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
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
                    // Force update to ensure latest content and FORCE load all images for printing
                    await this.updatePreview(true);

                    // Tiny delay to ensure images are rendered in parent layout
                    await new Promise(r => setTimeout(r, 100));

                    const wasEditor = this.currentView === 'editor';
                    if (wasEditor) {
                        this.paneEditor.classList.add('hidden');
                        this.panePreview.classList.remove('hidden');
                    }

                    window.print();

                    // Restore view
                    if (wasEditor) {
                        this.paneEditor.classList.remove('hidden');
                        this.panePreview.classList.add('hidden');
                    }
                    break;
                case 'copy-markdown':
                    await navigator.clipboard.writeText(content);
                    alert('Markdown copied to clipboard!');
                    break;
                case 'copy-text':
                    const plainTextCopy = this.convertToPlainText(content);
                    await navigator.clipboard.writeText(plainTextCopy);
                    alert('Text copied to clipboard!');
                    break;
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed: ' + error.message);
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

            // Phase 4: Vacuum orphaned images on save
            if (typeof data !== 'undefined') {
                await this.imageStorage.cleanupOrphanedImages(data);
            }

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
    applyAccessibilityPreferences() {
        if (window.matchMedia('(prefers-contrast: high)').matches) {
            this.dialog.classList.add('high-contrast');
        }
    }

    toggleMinimize() {
        const isMinimized = this.dialog.classList.toggle('minimized');
        const titleEl = this.dialog.querySelector('.notes-task-title');
        const detailEl = this.dialog.querySelector('.notes-task-detail');

        if (isMinimized) {
            this.dialog.classList.remove('maximized');

            // Truncate title
            const title = this.task.title;
            titleEl.textContent = title.length > 18 ? title.substring(0, 18) + "..." : title;
            if (detailEl) detailEl.style.display = 'none';

            // Ensure it's showing (non-modal)
            this.dialog.show();
        } else {
            titleEl.textContent = this.task.title;
            if (detailEl) detailEl.style.display = 'block';
            this.dialog.style.left = '';
            this.dialog.style.transform = '';

            // Restore as non-modal to avoid blocking other notes/app
            this.dialog.show();
        }

        MarkdownEditor.updateMinimizedPositions();
    }

    static updateMinimizedPositions() {
        const minimized = Array.from(document.querySelectorAll('.clsNotesModal.minimized'));
        if (minimized.length === 0) return;

        const gap = 10;
        const width = 160; // Base width from CSS
        const totalWidth = (minimized.length * width) + ((minimized.length - 1) * gap);
        const startLeft = (window.innerWidth - totalWidth) / 2;

        minimized.forEach((dialog, index) => {
            dialog.style.left = `${startLeft + (index * (width + gap))}px`;
            dialog.style.right = 'auto';
            dialog.style.transform = 'none';
        });
    }

    toggleMaximize() {
        const isMaximized = this.dialog.classList.toggle('maximized');
        if (isMaximized) {
            this.dialog.classList.remove('minimized');
            // Restore full title if it was minimized
            const titleEl = this.dialog.querySelector('.notes-task-title');
            const detailEl = this.dialog.querySelector('.notes-task-detail');
            titleEl.textContent = this.task.title;
            if (detailEl) detailEl.style.display = 'block';
        }
    }

    bringToFront() {
        const others = document.querySelectorAll('.clsNotesModal');
        let maxZ = 9000;
        others.forEach(d => {
            const style = window.getComputedStyle(d);
            const z = parseInt(style.zIndex);
            if (!isNaN(z) && z > maxZ) maxZ = z;
        });
        this.dialog.style.zIndex = maxZ + 1;
    }

    showHelpModal() {
        const shortcuts = [
            { key: 'Ctrl + B', desc: 'Bold' },
            { key: 'Ctrl + I', desc: 'Italic' },
            { key: 'Ctrl + U', desc: 'Underline' },
            { key: 'Ctrl + S', desc: 'Save & Close' },
            { key: 'Ctrl + Enter', desc: 'Save & Close' },
            { key: 'Ctrl + Z', desc: 'Undo' },
            { key: 'Ctrl + Y', desc: 'Redo' },
            { key: 'Ctrl + F', desc: 'Find / Replace' },
            { key: 'Ctrl + H', desc: 'Show this Help' },
            { key: 'Esc', desc: 'Close without saving (or saves if auto-save clicked)' }
        ];

        let helpDialog = document.getElementById('idNotesHelpDialog');
        if (!helpDialog) {
            helpDialog = document.createElement('dialog');
            helpDialog.id = 'idNotesHelpDialog';
            helpDialog.className = 'notes-help-dialog';
            document.body.appendChild(helpDialog);
        }

        helpDialog.innerHTML = `
            <div class="help-content">
                <h3>Notes Editor Shortcuts</h3>
                <div class="shortcut-list">
                    ${shortcuts.map(s => `
                        <div class="shortcut-item">
                            <span class="shortcut-key">${s.key}</span>
                            <span class="shortcut-desc">${s.desc}</span>
                        </div>
                    `).join('')}
                </div>
                <button onclick="this.closest('dialog').close()" class="help-close-btn">Got it</button>
            </div>
            <style>
                .notes-help-dialog {
                    border: none;
                    border-radius: 12px;
                    padding: 20px;
                    background: var(--color-bg-container);
                    color: var(--color-text-primary);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    max-width: 350px;
                }
                .help-content h3 { margin-top: 0; color: var(--color-accent); }
                .shortcut-list { margin: 15px 0; }
                .shortcut-item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
                .shortcut-key { font-weight: bold; background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; }
                .help-close-btn { 
                    width: 100%; padding: 10px; border: none; border-radius: 6px; 
                    background: var(--color-accent); color: white; cursor: pointer; font-weight: bold;
                }
            </style>
        `;
        helpDialog.showModal();
    }


    showAutoSaveInfo() {
        // Remove any existing popup
        const existingPopup = document.getElementById('idAutoSaveInfoPopup');
        if (existingPopup) {
            existingPopup.remove();
            return; // Toggle behavior - clicking again closes it
        }

        const saveStatus = this.dialog.querySelector('#idSaveStatus');
        if (!saveStatus) return;

        // Create popup element
        const popup = document.createElement('div');
        popup.id = 'idAutoSaveInfoPopup';
        popup.className = 'auto-save-popup';
        popup.innerHTML = `
            <div class="auto-save-popup-content">
                <div class="auto-save-popup-header">
                    <i class="material-icons">info</i>
                    <strong>Auto-Save</strong>
                </div>
                <div class="auto-save-popup-body">
                    <p>Your notes are <strong>automatically saved</strong> as you type.</p>
                    <div class="auto-save-status-list">
                        <div class="auto-save-status-item">
                            <i class="material-icons" style="color: #4CAF50;">check_circle</i>
                            <span><strong>Saved</strong> - All changes saved</span>
                        </div>
                        <div class="auto-save-status-item">
                            <i class="material-icons" style="color: #FFC107;">sync</i>
                            <span><strong>Saving...</strong> - Currently saving</span>
                        </div>
                        <div class="auto-save-status-item">
                            <i class="material-icons" style="color: #FF9800;">pending</i>
                            <span><strong>Unsaved</strong> - Changes pending</span>
                        </div>
                    </div>
                    <p class="auto-save-footer">Simply close the editor when you're done!</p>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Position the popup near the save status
        const rect = saveStatus.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.bottom = `${window.innerHeight - rect.top + 10}px`;
        popup.style.right = `${window.innerWidth - rect.right}px`;

        // Close popup when clicking outside
        const closePopup = (e) => {
            if (!popup.contains(e.target) && e.target !== saveStatus) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        };

        // Delay adding the listener to prevent immediate closure
        setTimeout(() => {
            document.addEventListener('click', closePopup);
        }, 100);

        // Auto-close after 8 seconds
        setTimeout(() => {
            if (popup.parentElement) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        }, 8000);
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
