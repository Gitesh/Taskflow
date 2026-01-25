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
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;
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
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </button>
              <button class="btn-close-notes" id="btnCloseNotes" aria-label="Close">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
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
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
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
            <button class="notes-btn-save" id="btnSaveClose">Save & Close</button>
          </div>
        </div>

        <div class="notes-export-menu" id="idExportMenu" style="display: none;">
          <button data-export="markdown-file">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            Export as Markdown (.md)
          </button>
          <button data-export="text-file">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            Export as Text (.txt)
          </button>
          <button data-export="pdf-file">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
            Export as PDF
          </button>
          <div class="export-divider"></div>
            <button data-export="copy-markdown">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                Copy as Markdown
            </button>
            <button data-export="copy-text">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>
                Copy as Plain Text
            </button>
          </div>
          
          <div class="notes-search-panel" id="idSearchPanel" style="display: none;">
            <input type="text" id="idSearchInput" placeholder="Find...">
            <button class="notes-search-btn" id="btnFindPrev" title="Previous"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg></button>
            <button class="notes-search-btn" id="btnFindNext" title="Next"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg></button>
            <div class="divider"></div>
            <input type="text" id="idReplaceInput" placeholder="Replace...">
            <button class="notes-search-btn" id="btnReplace" title="Replace"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11 6c1.38 0 2.63.56 3.54 1.46L12 10h6V4l-2.05 2.05C14.68 4.78 12.93 4 11 4c-3.53 0-6.43 2.61-6.92 6h2.02c.47-2.26 2.43-4 4.9-4zM12 14v6l2.05-2.05C15.32 19.22 17.07 20 19 20c3.53 0 6.43-2.61 6.92-6h-2.02c-.47 2.26-2.43 4-4.9 4-1.38 0-2.63-.56-3.54-1.46L18 14h-6z"/></svg></button>
            <button class="notes-search-btn" id="btnReplaceAll" title="Replace All"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg></button>
            <div class="divider"></div>
            <button class="notes-search-btn" id="btnCloseSearch" title="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
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

            // Only update preview if the user is not actively typing in it
            const isEditingInPreview = this.preview.contains(this.lastActiveElement);
            if (!isEditingInPreview) {
                debouncedUpdate();
            }

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

    setupSearch() {
        const panel = document.getElementById('idSearchPanel');
        const searchInput = document.getElementById('idSearchInput');
        const replaceInput = document.getElementById('idReplaceInput');
        const btnFindNext = document.getElementById('btnFindNext');
        const btnFindPrev = document.getElementById('btnFindPrev');
        const btnReplace = document.getElementById('btnReplace');
        const btnReplaceAll = document.getElementById('btnReplaceAll');
        const btnClose = document.getElementById('btnCloseSearch');

        // Toggle search with Ctrl+F
        this.cleanupManager.addEventListener(this.dialog, 'keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.toggleSearchPanel();
            }
        });

        // Close
        this.cleanupManager.addEventListener(btnClose, 'click', () => {
            panel.style.display = 'none';
            this.textarea.focus();
        });

        // Find Logic
        const find = (forward = true) => {
            const query = searchInput.value;
            if (!query) return;

            this.textarea.focus();

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
            } else {
                // Not found
                searchInput.classList.add('error');
                setTimeout(() => searchInput.classList.remove('error'), 500);
            }
        };

        this.cleanupManager.addEventListener(btnFindNext, 'click', () => find(true));
        this.cleanupManager.addEventListener(btnFindPrev, 'click', () => find(false));
        this.cleanupManager.addEventListener(searchInput, 'keydown', (e) => {
            if (e.key === 'Enter') find(true);
        });

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
            let html = this.parser.parse(this.textarea.value);

            // Phase 4: Add XSS protection
            html = HtmlSanitizer.sanitize(html);

            this.preview.innerHTML = html;
            this.preview.scrollTop = scrollPos;
            await this.resolveImages();
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
    }

    handleUndoRedo(isUndo = true) {
        const stack = isUndo ? this.undoStack : this.redoStack;
        const otherStack = isUndo ? this.redoStack : this.undoStack;

        if (stack.length === 0) return;

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
        // Save current state before any action
        this.saveToHistory();

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
                case 'search': this.toggleSearchPanel(); break;
                default:
                    console.warn('Action not recognized in textarea:', action);
                    break;
            }
        } else if (this.lastActiveElement && this.lastActiveElement.isContentEditable) {
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
            case 'search':
                this.toggleSearchPanel();
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
        const panel = document.getElementById('idSearchPanel');
        const searchInput = document.getElementById('idSearchInput');
        if (!panel || !searchInput) return;

        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'flex' : 'none';

        if (isHidden) {
            searchInput.focus();
            const selection = window.getSelection().toString();
            if (selection) {
                searchInput.value = selection;
            }
        } else {
            this.textarea.focus();
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
                    // Force update to ensure latest content
                    await this.updatePreview();

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
