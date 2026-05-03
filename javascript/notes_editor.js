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
        if (!text) text = "";

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
                htmlResult.push(`<div data-line="${i}">${parseInline(rawLine.substring(1).trim())}</div>`);
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
                htmlResult.push(`<div data-line="${i}" class="empty-line">&nbsp;</div>`);
                continue;
            }

            // Headings
            if (rawLine.startsWith('# ')) {
                htmlResult.push(`<h1 data-line="${i}" class="markdown-h1">${parseInline(rawLine.substring(2))}</h1>`);
            } else if (rawLine.startsWith('## ')) {
                htmlResult.push(`<h2 data-line="${i}" class="markdown-h2">${parseInline(rawLine.substring(3))}</h2>`);
            } else if (rawLine.startsWith('### ')) {
                htmlResult.push(`<h3 data-line="${i}" class="markdown-h3">${parseInline(rawLine.substring(4))}</h3>`);
            }
            // Lists & Task Lists (Support indentation, allow no space but ignore bold/tags)
            else if (line.match(/^(\s*)(?:-(?!(?:-)|(?:\s*[adfq]-))|\*(?!\*))(?:\s*)/)) {
                const match = line.match(/^(\s*)(?:-(?!(?:-)|(?:\s*[adfq]-))|\*(?!\*))(?:\s*)/);
                const indent = match[1].length;

                if (!inList) {
                    htmlResult.push('<ul class="markdown-list">');
                    inList = true;
                }

                const isTask = rawLine.includes('[ ]') || rawLine.includes('[x]');
                const content = parseInline(line.substring(match[0].length));
                const style = indent > 0 ? `style="margin-left: ${indent * 10}px"` : "";

                htmlResult.push(`<li class="${isTask ? 'task-item' : ''}" data-line="${i}" ${style}>${content}</li>`);
            } else {
                if (inList) {
                    htmlResult.push('</ul>');
                    inList = false;
                }
                if (rawLine !== '') {
                    htmlResult.push(`<div data-line="${i}" class="markdown-paragraph">${parseInline(rawLine)}</div>`);
                } else {
                    htmlResult.push(`<div data-line="${i}" class="empty-line">&nbsp;</div>`);
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
                if (node.classList.contains('md-hash')) {
                    return node.textContent;
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

            case 'hr':
                return '---';

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
        this.currentView = 'preview';
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;
        this.isActionInProgress = false;
        this.isSyncingFromPreview = false;
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

            // Apply view state
            this.setView(this.currentView);

            // Push initial state to undo stack
            this.saveToHistory();

            // Show as non-modal to allow multitasking and preserve app interaction
            this.dialog.show();

            // Check for high contrast
            this.applyAccessibilityPreferences();

            // Focus appropriate element based on current view
            if (this.currentView === 'editor' || this.currentView === 'split') {
                this.textarea.focus();
                this.textarea.setSelectionRange(0, 0);
            } else if (this.currentView === 'preview') {
                const firstBlock = this.preview.querySelector('[data-line]');
                if (firstBlock) {
                    firstBlock.focus();
                    const sel = window.getSelection();
                    const ran = document.createRange();
                    if (firstBlock.firstChild) {
                        if (firstBlock.firstChild.nodeType === 3) {
                            ran.setStart(firstBlock.firstChild, 0);
                        } else {
                            ran.setStart(firstBlock, 0);
                        }
                    } else {
                        ran.setStart(firstBlock, 0);
                    }
                    ran.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(ran);
                }
            }
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
              <label for="idNotesTextarea">Markdown</label>
              <div class="editor-wrapper">
                  <pre class="syntax-layer" id="idSyntaxLayer" aria-hidden="true"></pre>
                  <textarea id="idNotesTextarea" aria-label="Markdown editor" placeholder="Type your notes here... Use # for headings, ** for bold, etc.">${this.task.notes || ""}</textarea>
              </div>
            </div>
            <div class="notes-preview-pane" id="panePreview">
              <label>Editor</label>
              <div id="idNotesPreview" role="region" aria-live="polite" aria-label="Markdown editor"></div>
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
              <button class="notes-toggle-btn" id="btnViewEditor" aria-label="Markdown only view">Markdown</button>
              <button class="notes-toggle-btn" id="btnViewSplit" aria-label="Split view">Split</button>
              <button class="notes-toggle-btn active" id="btnViewPreview" aria-label="Editor only view">Editor</button>
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

        this.preview.contentEditable = "true";
        this.preview.spellcheck = true;
        this.preview.classList.add('editor-root');

        this.highlighter = new SyntaxHighlighter();
        this.highlight();

        this.scrollSync = new ScrollSyncManager(this.textarea, this.preview);
        this.scrollSync.init(this.cleanupManager);

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
            if (this.scrollSync && this.lastActiveElement === this.textarea) {
                this.scrollSync.forceSync();
            }
        }, 300);

        this.cleanupManager.addEventListener(this.textarea, 'input', () => this.handleMarkdownInput());
        this.cleanupManager.addEventListener(this.preview, 'input', (e) => this.handleEditorInput(e));
        this.cleanupManager.addEventListener(this.textarea, 'keydown', (e) => this.handleTextareaShortcuts(e));
        this.cleanupManager.addEventListener(this.preview, 'keydown', (e) => {
            this.handleEditorShortcuts(e);
            this.handlePreviewKeydown(e);
        });

        this.cleanupManager.addEventListener(this.dialog.querySelector('#btnViewEditor'), 'click', () => this.setView('editor'));
        this.cleanupManager.addEventListener(this.dialog.querySelector('#btnViewSplit'), 'click', () => this.setView('split'));
        this.cleanupManager.addEventListener(this.dialog.querySelector('#btnViewPreview'), 'click', () => this.setView('preview'));

        const toolbarButtons = this.dialog.querySelectorAll('.notes-toolbar [data-action]');
        toolbarButtons.forEach(btn => {
            this.cleanupManager.addEventListener(btn, 'click', (e) => {
                e.preventDefault();
                this.handleToolbarAction(btn.getAttribute('data-action'));
            });
            this.cleanupManager.addEventListener(btn, 'mousedown', (e) => e.preventDefault());
        });

        const handlePaste = (e) => this.handlePaste(e);
        this.cleanupManager.addEventListener(this.textarea, 'paste', handlePaste);
        this.cleanupManager.addEventListener(this.preview, 'paste', handlePaste);

        this.cleanupManager.addEventListener(this.textarea, 'focus', () => {
            this.lastActiveElement = this.textarea;
            this.bringToFront();
        });
        this.cleanupManager.addEventListener(this.textarea, 'click', () => {
            this.highlight();
            this.highlightPreviewSearch();
        });
        this.cleanupManager.addEventListener(this.textarea, 'keyup', () => {
            this.highlight();
            this.highlightPreviewSearch();
        });
        this.cleanupManager.addEventListener(this.preview, 'focusin', (e) => {
            this.lastActiveElement = e.target;
            this.bringToFront();
        });

        this.cleanupManager.addEventListener(window, 'resize', () => {
            MarkdownEditor.updateMinimizedPositions();
        });

        const btnMin = this.dialog.querySelector('#btnMinimiseNotes');
        if (btnMin) this.cleanupManager.addEventListener(btnMin, 'click', (e) => { e.stopPropagation(); this.toggleMinimize(); });
        const btnMax = this.dialog.querySelector('#btnMaximiseNotes');
        if (btnMax) this.cleanupManager.addEventListener(btnMax, 'click', (e) => { e.stopPropagation(); this.toggleMaximize(); });

        this.cleanupManager.addEventListener(this.dialog.querySelector('.notes-header'), 'click', () => {
            if (this.dialog.classList.contains('minimized')) this.toggleMinimize();
        });

        const saveStatus = this.dialog.querySelector('#idSaveStatus');
        if (saveStatus) this.cleanupManager.addEventListener(saveStatus, 'click', () => this.showAutoSaveInfo());

        const btnHeaderClose = this.dialog.querySelector('#btnCloseNotes');
        if (btnHeaderClose) this.cleanupManager.addEventListener(btnHeaderClose, 'click', () => this.saveAndClose());

        this.cleanupManager.addEventListener(this.dialog, 'keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); this.saveAndClose(); }
            this.handleKeyboardShortcuts(e);
        });

        this.cleanupManager.addEventListener(this.dialog, 'mousedown', () => this.bringToFront());
        this.cleanupManager.addEventListener(this.dialog, 'click', (e) => { if (e.target === this.dialog) this.saveAndClose(); });

        this.setupExportMenu();
        this.setupDragAndDrop();
        this.setupSearch();
    }

    setupDragAndDrop() {
        const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); };
        const handleDrop = async (e) => {
            e.preventDefault(); e.stopPropagation();
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        try {
                            const compressedBlob = await this.imageStorage.compressImage(file);
                            const id = await this.imageStorage.saveImage(compressedBlob, { altText: file.name, taskIndex: this.taskIndex });
                            const markdown = `![${file.name}](tf-img://${id})\n`;
                            if (this.lastActiveElement === this.textarea) this.insertMarkdown(markdown, '');
                            else { this.textarea.value += '\n' + markdown; this.textarea.dispatchEvent(new Event('input', { bubbles: true })); }
                        } catch (error) { console.error('Image upload failed:', error); }
                    }
                }
            }
        };
        ['dragenter', 'dragover', 'dragleave'].forEach(eventName => this.cleanupManager.addEventListener(this.dialog, eventName, handleDrag));
        this.cleanupManager.addEventListener(this.dialog, 'drop', handleDrop);
    }

    setupExportMenu() {
        const exportBtn = this.dialog.querySelector('#btnExportNotes');
        const exportMenu = this.dialog.querySelector('#idExportMenu');
        this.cleanupManager.addEventListener(exportBtn, 'click', (e) => { e.stopPropagation(); exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none'; });
        this.cleanupManager.addEventListener(document, 'click', () => { exportMenu.style.display = 'none'; });
        const exportButtons = exportMenu.querySelectorAll('[data-export]');
        exportButtons.forEach(btn => { this.cleanupManager.addEventListener(btn, 'click', (e) => { e.stopPropagation(); this.handleExport(btn.getAttribute('data-export')); exportMenu.style.display = 'none'; }); });
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

        this.cleanupManager.addEventListener(btnClose, 'click', () => { panel.style.display = 'none'; this.textarea.focus(); });

        const find = (forward = true) => {
            const query = searchInput.value;
            if (!query) return;
            const text = this.textarea.value;
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            let index = forward ? text.indexOf(query, end) : text.lastIndexOf(query, start - 1);
            if (index === -1) index = forward ? text.indexOf(query, 0) : text.lastIndexOf(query);
            if (index !== -1) {
                this.textarea.setSelectionRange(index, index + query.length);
                const lineNo = text.substr(0, index).split('\n').length;
                this.textarea.scrollTop = (lineNo - 5) * 21;
                this.highlight();
                this.highlightPreviewSearch();
            } else {
                searchInput.classList.add('error');
                setTimeout(() => searchInput.classList.remove('error'), 500);
            }
        };

        this.cleanupManager.addEventListener(btnFindNext, 'click', () => find(true));
        this.cleanupManager.addEventListener(btnFindPrev, 'click', () => find(false));
        this.cleanupManager.addEventListener(searchInput, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(true); } });
        this.cleanupManager.addEventListener(searchInput, 'input', debounce(() => { this.highlight(); this.highlightPreviewSearch(); }, 150));

        this.cleanupManager.addEventListener(btnReplace, 'click', () => {
            const query = searchInput.value;
            const replacement = replaceInput.value;
            if (!query) return;
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            if (this.textarea.value.substring(start, end) === query) {
                this.textarea.setRangeText(replacement, start, end, 'select');
                this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                find(true);
            } else find(true);
        });

        this.cleanupManager.addEventListener(btnReplaceAll, 'click', () => {
            const query = searchInput.value;
            const replacement = replaceInput.value;
            if (!query) return;
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const newText = this.textarea.value.replace(regex, replacement);
            if (this.textarea.value !== newText) {
                this.textarea.value = newText;
                this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    setView(view) {
        this.currentView = view;
        this.paneEditor.classList.toggle('hidden', view === 'preview');
        this.panePreview.classList.toggle('hidden', view === 'editor');
        this.dialog.querySelectorAll('.notes-toggle-btn').forEach(b => b.classList.toggle('active', b.id === `btnView${view.charAt(0).toUpperCase() + view.slice(1)}`));
    }

    async updatePreview(isFullRefresh = false) {
        if (isFullRefresh) this.parser.cache.clear();
        try {
            const selection = window.getSelection();
            const isActive = (document.activeElement === this.preview || this.preview.contains(document.activeElement));
            let savedOffset = isActive && selection.rangeCount > 0 ? this.getGlobalCaretOffset(this.preview) : 0;

            const scrollPos = this.preview.scrollTop;
            let html = this.parser.parse(this.textarea.value);
            html = HtmlSanitizer.sanitize(html);
            this.preview.innerHTML = html;
            this.preview.scrollTop = scrollPos;

            await this.resolveImages(isFullRefresh);
            this.highlightPreviewSearch();

            if (isActive) this.setGlobalCaretOffset(this.preview, savedOffset);
        } catch (error) { console.error('Error updating preview:', error); }
    }

    handleMarkdownInput() {
        this.updateStats();
        this.autoSave.markDirty();
        if (!this.isSyncingFromPreview) this.updatePreview();
    }

    handleEditorInput(e) {
        if (this.isActionInProgress) return;
        this.isSyncingFromPreview = true;
        try {
            this.scanAndReplaceLivePatterns();
            this.syncEditorToMarkdown();
            this.updateStats();
            this.autoSave.markDirty();
            this.highlight();
        } finally {
            this.isSyncingFromPreview = false;
        }
    }

    scanAndReplaceLivePatterns() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== 3) return;

        const text = node.textContent.replace(/\u00A0/g, ' ');
        
        // Find the block-level container
        let block = node.parentElement;
        while (block && block !== this.preview && !block.hasAttribute('data-line') && !['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(block.tagName)) {
            block = block.parentElement;
        }
        if (!block || block === this.preview) return;

        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(block);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        const textBeforeCaret = preCaretRange.toString().replace(/\u00A0/g, ' ');
        const blockOffset = textBeforeCaret.length;

        // Structural Triggers (must be at start of block)
        if (blockOffset >= 2 && blockOffset <= 4 && textBeforeCaret.match(/^(#{1,3})\s$/)) {
            const level = textBeforeCaret.match(/^(#{1,3})\s/);
            const tag = `H${level[1].length}`;
            
            // Re-fetch node and offset to be extremely precise
            const matchRange = document.createRange();
            matchRange.setStart(node, 0);
            matchRange.setEnd(node, level[0].length);
            
            const hashSpan = document.createElement('span');
            hashSpan.className = 'md-syntax md-hash';
            hashSpan.setAttribute('contenteditable', 'false');
            hashSpan.textContent = level[0];
            
            matchRange.deleteContents();
            matchRange.insertNode(hashSpan);

            // Change block type if not already correct
            if (block.tagName !== tag) {
                const newHeading = document.createElement(tag);
                const dataLine = block.getAttribute('data-line');
                if (dataLine) newHeading.setAttribute('data-line', dataLine);
                newHeading.className = `markdown-h${level[1].length}`;
                newHeading.innerHTML = block.innerHTML;
                block.parentNode.replaceChild(newHeading, block);
                
                // Restore caret to after the hidden span
                const newRange = document.createRange();
                newRange.setStartAfter(newHeading.querySelector('.md-hash'));
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
            
            this.syncEditorToMarkdown();
            return;
        }

        if (blockOffset === 2 && textBeforeCaret === '- ') {
            const deleteRange = document.createRange();
            deleteRange.selectNodeContents(block);
            deleteRange.setEnd(range.startContainer, range.startOffset);
            deleteRange.deleteContents();
            document.execCommand('insertUnorderedList');
            return;
        }

        if (blockOffset === 3 && (textBeforeCaret === '---' || textBeforeCaret === '***' || textBeforeCaret === '___')) {
            const deleteRange = document.createRange();
            deleteRange.selectNodeContents(block);
            deleteRange.setEnd(range.startContainer, range.startOffset);
            deleteRange.deleteContents();
            
            const nextPara = document.createElement('div');
            nextPara.innerHTML = '&nbsp;';
            block.parentNode.insertBefore(nextPara, block.nextSibling);
            block.innerHTML = '<hr class="markdown-hr">';
            this.syncEditorToMarkdown();
            
            const newRange = document.createRange();
            newRange.setStart(nextPara, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            nextPara.focus();
            return;
        }

        // Inline patterns (tags)
        const patterns = [
            { regex: /-a-/gi, html: '<span class="note-tag action" contenteditable="false" onclick="clkNoteTag(\'action\')">action</span>&nbsp;' },
            { regex: /-f-/gi, html: '<span class="note-tag finding" contenteditable="false" onclick="clkNoteTag(\'finding\')">finding</span>&nbsp;' },
            { regex: /-d-/gi, html: '<span class="note-tag documentation" contenteditable="false" onclick="clkNoteTag(\'documentation\')">documentation</span>&nbsp;' },
            { regex: /-q-/gi, html: '<span class="note-tag question" contenteditable="false" onclick="clkNoteTag(\'question\')">question</span>&nbsp;' },
            { regex: /\[ \] /g, html: '<input type="checkbox" aria-label="Task item">&nbsp;' },
            { regex: /\[x\] /g, html: '<input type="checkbox" checked aria-label="Completed task">&nbsp;' }
        ];

        for (const p of patterns) {
            const regex = new RegExp(p.regex);
            const match = regex.exec(text);
            if (match) {
                const offset = match.index;
                const matchText = match[0];
                if (range.startOffset < offset + matchText.length) continue;

                const temp = document.createElement('div');
                temp.innerHTML = p.html;
                const fragment = document.createDocumentFragment();
                const nodesToInsert = Array.from(temp.childNodes);
                nodesToInsert.forEach(n => fragment.appendChild(n));
                const lastInsertedNode = nodesToInsert[nodesToInsert.length - 1];

                const matchRange = document.createRange();
                matchRange.setStart(node, offset);
                matchRange.setEnd(node, offset + matchText.length);
                matchRange.deleteContents();
                matchRange.insertNode(fragment);

                const newRange = document.createRange();
                if (lastInsertedNode.nodeType === 3) {
                    newRange.setStart(lastInsertedNode, lastInsertedNode.textContent.length);
                } else {
                    newRange.setStartAfter(lastInsertedNode);
                }
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                break;
            }
        }
    }

    syncEditorToMarkdown() {
        const mdLines = [];
        const lines = this.textarea.value.split('\n');

        const processBlock = (block) => {
            const lineIdx = parseInt(block.getAttribute('data-line'), 10);
            let prefix = "";
            if (!isNaN(lineIdx) && lines[lineIdx]) {
                const prefixMatch = lines[lineIdx].match(/^(\s*(?:#{1,6}|>|-(?!(?:-)|(?:\s*[adfq]-))|\*(?!\*))\s*(?:\[[ x]\]\s*)?)/);
                prefix = prefixMatch ? prefixMatch[1] : "";
            }

            let content = this.htmlConverter.convert(block.innerHTML, true, true).replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ');

            // If we have a prefix and content doesn't already include it (common for lists), prepend it
            if (prefix && !content.trimStart().startsWith(prefix.trim())) {
                mdLines.push(prefix + content);
            } else {
                mdLines.push(content);
            }
        };

        const children = Array.from(this.preview.childNodes);
        children.forEach(child => {
            if (child.nodeType === 1) { // Element
                const tag = child.tagName;
                if (tag === 'UL' || tag === 'OL' || tag === 'BLOCKQUOTE') {
                    Array.from(child.children).forEach(inner => processBlock(inner));
                } else if (tag === 'DIV' || tag === 'P' || tag.startsWith('H')) {
                    processBlock(child);
                } else if (tag === 'HR') {
                    mdLines.push('---');
                }
            } else if (child.nodeType === 3 && child.textContent.trim()) {
                // Handle stray text nodes at root level if any
                mdLines.push(child.textContent);
            }
        });

        const newMarkdown = mdLines.join('\n');
        if (this.textarea.value !== newMarkdown) {
            this.textarea.value = newMarkdown;
            this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    getGlobalCaretOffset(element) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return 0;
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        return preCaretRange.toString().length;
    }

    setGlobalCaretOffset(element, offset) {
        const selection = window.getSelection();
        const range = document.createRange();
        let currentOffset = 0, nodeFound = false;
        const traverse = (node) => {
            if (nodeFound) return;
            if (node.nodeType === 3) {
                const len = node.textContent.length;
                if (currentOffset + len >= offset) { range.setStart(node, offset - currentOffset); range.collapse(true); nodeFound = true; }
                currentOffset += len;
            } else { for (let i = 0; i < node.childNodes.length; i++) { traverse(node.childNodes[i]); if (nodeFound) return; } }
        };
        traverse(element);
        if (nodeFound) { selection.removeAllRanges(); selection.addRange(range); }
    }

    handleEditorShortcuts(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const selection = window.getSelection();
            const lineBlocks = [];
            if (!selection.isCollapsed) {
                Array.from(this.preview.querySelectorAll('[data-line]')).forEach(b => { if (selection.containsNode(b, true)) lineBlocks.push(b); });
            } else {
                const block = e.target.closest('[data-line]');
                if (block) lineBlocks.push(block);
            }
            if (lineBlocks.length > 0) {
                const lines = this.textarea.value.split('\n');
                lineBlocks.forEach(b => {
                    const idx = parseInt(b.getAttribute('data-line'), 10);
                    if (!isNaN(idx)) {
                        if (e.shiftKey) lines[idx] = lines[idx].startsWith('  ') ? lines[idx].substring(2) : (lines[idx].startsWith(' ') ? lines[idx].substring(1) : lines[idx]);
                        else lines[idx] = '  ' + lines[idx];
                    }
                });
                this.textarea.value = lines.join('\n');
                this.updatePreview();
            }
        }
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            const block = e.target.closest('[data-line]');
            if (block) {
                e.preventDefault();
                const lineIdx = parseInt(block.getAttribute('data-line'), 10);
                const lines = this.textarea.value.split('\n');
                const targetIdx = e.key === 'ArrowUp' ? lineIdx - 1 : lineIdx + 1;
                if (targetIdx >= 0 && targetIdx < lines.length) {
                    [lines[lineIdx], lines[targetIdx]] = [lines[targetIdx], lines[lineIdx]];
                    this.textarea.value = lines.join('\n');
                    this.updatePreview();
                }
            }
        }
        if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
            const block = e.target.closest('[data-line]');
            if (block) {
                e.preventDefault();
                const lineIdx = parseInt(block.getAttribute('data-line'), 10);
                const lines = this.textarea.value.split('\n');
                lines.splice(lineIdx + 1, 0, lines[lineIdx]);
                this.textarea.value = lines.join('\n');
                this.updatePreview();
            }
        }
    }

    handleTextareaShortcuts(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.textarea.selectionStart, end = this.textarea.selectionEnd, value = this.textarea.value;
            if (start === end) {
                this.textarea.value = value.substring(0, start) + '  ' + value.substring(start);
                this.textarea.setSelectionRange(start + 2, start + 2);
            } else {
                const lineStart = value.substring(0, start).lastIndexOf('\n') + 1, lineEnd = value.indexOf('\n', end);
                const actualEnd = lineEnd === -1 ? value.length : lineEnd;
                const lines = value.substring(lineStart, actualEnd).split('\n');
                const newLines = lines.map(line => e.shiftKey ? (line.startsWith('  ') ? line.substring(2) : (line.startsWith(' ') ? line.substring(1) : line)) : '  ' + line);
                this.textarea.value = value.substring(0, lineStart) + newLines.join('\n') + value.substring(actualEnd);
                this.textarea.setSelectionRange(lineStart, lineStart + newLines.join('\n').length);
            }
            this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    handleToolbarAction(action) {
        const isPreviewActive = (document.activeElement === this.preview || this.preview.contains(document.activeElement));
        if (action === 'search') { this.toggleSearchPanel(); return; }
        if (action === 'help') { this.showHelpModal(); return; }
        if (action === 'undo') { this.handleUndoRedo(true); return; }
        if (action === 'redo') { this.handleUndoRedo(false); return; }
        this.saveToHistory();
        if (isPreviewActive) this.applyFormatModern(action);
        else {
            switch (action) {
                case 'bold': this.insertMarkdown('**', '**'); break;
                case 'italic': this.insertMarkdown('*', '*'); break;
                case 'underline': this.insertMarkdown('<u>', '</u>'); break;
                case 'strikethrough': this.insertMarkdown('~~', '~~'); break;
                case 'subscript': this.insertMarkdown('~', '~'); break;
                case 'superscript': this.insertMarkdown('^', '^'); break;
                case 'code': const sel = this.textSelection.getSelectedText(); if (sel.includes('\n')) this.insertMarkdown('```\n', '\n```'); else this.insertMarkdown('`', '`'); break;
                case 'header1': this.insertMarkdown('# ', ''); break;
                case 'header2': this.insertMarkdown('## ', ''); break;
                case 'header3': this.insertMarkdown('### ', ''); break;
                case 'link': this.handleLinkAction(); break;
                case 'list': this.insertMarkdown('- ', ''); break;
                case 'task': this.insertMarkdown('[ ] ', ''); break;
                case 'hr': this.insertMarkdown('\n---\n', ''); break;
            }
        }
        this.updateStats();
        this.autoSave.markDirty();
    }

    applyFormatModern(action, val = null) {
        switch (action) {
            case 'bold': document.execCommand('bold', false, val); break;
            case 'italic': document.execCommand('italic', false, val); break;
            case 'underline': document.execCommand('underline', false, val); break;
            case 'strikethrough': document.execCommand('strikeThrough', false, val); break;
            case 'header1': document.execCommand('formatBlock', false, '<h1>'); break;
            case 'header2': document.execCommand('formatBlock', false, '<h2>'); break;
            case 'header3': document.execCommand('formatBlock', false, '<h3>'); break;
            case 'list': document.execCommand('insertUnorderedList', false, val); break;
            case 'task': document.execCommand('insertHTML', false, '<li>[ ] &nbsp;</li>'); break;
            case 'link': const url = prompt("Enter URL:", "https://"); if (url) document.execCommand('createLink', false, url); break;
        }
        this.handleEditorInput();
    }

    insertMarkdown(before, after) { this.textSelection.wrapSelection(before, after); this.updatePreview(); }
    handleLinkAction() { const url = prompt("Enter URL:", "https://"); if (url) this.insertMarkdown("[", `](${url})`); }

    handlePaste(e) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) { if (item.type.indexOf("image") !== -1) { const blob = item.getAsFile(); this.uploadImage(blob); } }
    }

    async uploadImage(blob) {
        try {
            const compressedBlob = await this.imageStorage.compressImage(blob);
            const id = await this.imageStorage.saveImage(compressedBlob, { altText: "pasted_image", taskIndex: this.taskIndex });
            const mdRef = `![pasted_image](tf-img://${id})`;
            if (this.lastActiveElement === this.textarea) this.insertMarkdown(mdRef, "");
            else {
                const selection = window.getSelection();
                if (selection.rangeCount) {
                    const range = selection.getRangeAt(0), img = document.createElement('img');
                    img.src = URL.createObjectURL(compressedBlob); img.setAttribute('data-img-id', id); img.className = 'pasted-image';
                    range.insertNode(img); range.insertNode(document.createTextNode(' '));
                    this.handleEditorInput();
                }
            }
        } catch (error) { console.error('Image upload failed:', error); }
    }

    saveToHistory() {
        const currentContent = this.textarea.value;
        if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1].content === currentContent) return;
        const isPreviewActive = (document.activeElement === this.preview || this.preview.contains(document.activeElement));
        this.undoStack.push({ content: currentContent, selectionStart: this.textarea.selectionStart, selectionEnd: this.textarea.selectionEnd, previewOffset: isPreviewActive ? this.getGlobalCaretOffset(this.preview) : -1 });
        if (this.undoStack.length > this.maxStackSize) this.undoStack.shift();
        this.redoStack = [];
    }

    async handleUndoRedo(isUndo = true) {
        const stack = isUndo ? this.undoStack : this.redoStack, otherStack = isUndo ? this.redoStack : this.undoStack;
        if (stack.length === 0) return;
        this.isActionInProgress = true;
        try {
            const isPreviewActive = (document.activeElement === this.preview || this.preview.contains(document.activeElement));
            otherStack.push({ content: this.textarea.value, selectionStart: this.textarea.selectionStart, selectionEnd: this.textarea.selectionEnd, previewOffset: isPreviewActive ? this.getGlobalCaretOffset(this.preview) : -1 });
            const state = stack.pop();
            this.textarea.value = state.content;
            this.textarea.setSelectionRange(state.selectionStart, state.selectionEnd);
            await this.updatePreview();
            if (state.previewOffset !== -1) { this.preview.focus(); this.setGlobalCaretOffset(this.preview, state.previewOffset); }
        } finally { this.isActionInProgress = false; }
    }

    updateStats() {
        const text = this.textarea.value, words = text.trim() ? text.trim().split(/\s+/).length : 0, chars = text.length, readTime = Math.ceil(words / 200);
        const wordCountEl = this.dialog.querySelector('#idWordCount'), charCountEl = this.dialog.querySelector('#idCharCount'), readTimeEl = this.dialog.querySelector('#idReadTime');
        if (wordCountEl) wordCountEl.textContent = `${words} words`;
        if (charCountEl) charCountEl.textContent = `${chars} characters`;
        if (readTimeEl) readTimeEl.textContent = `${readTime} min read`;
    }

    async resolveImages(forceLoad = false) {
        const images = this.preview.querySelectorAll('img[data-img-id]');
        for (const img of images) {
            const id = img.getAttribute('data-img-id');
            if (id && (!img.src || img.src.startsWith('blob:') || forceLoad)) {
                try {
                    const blob = await this.imageStorage.getImage(id);
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        img.src = url;
                        this.cleanupManager.addBlobUrl(url);
                    }
                } catch (e) { console.error('Failed to resolve image:', id, e); }
            }
        }
    }

    highlightPreviewSearch() {
        const searchInput = this.dialog.querySelector('#idSearchInput'), searchPanel = this.dialog.querySelector('#idSearchPanel');
        if (!this.preview || !searchInput || !searchPanel || searchPanel.style.display === 'none') return;
        const query = searchInput.value; if (!query) return;
        let activeMatchIndex = -1;
        const textareaText = this.textarea.value, selectionStart = this.textarea.selectionStart;
        if (selectionStart !== -1) {
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            let match, count = 0;
            while ((match = regex.exec(textareaText)) !== null) {
                if (selectionStart >= match.index && selectionStart <= match.index + match[0].length) { activeMatchIndex = count; break; }
                count++;
            }
        }
        const walker = document.createTreeWalker(this.preview, NodeFilter.SHOW_TEXT, null, false);
        const nodes = []; let node; while (node = walker.nextNode()) nodes.push(node);
        let globalMatchCount = 0;
        nodes.forEach(textNode => {
            const text = textNode.textContent, regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            if (regex.test(text)) {
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                text.replace(regex, (match, p1, offset) => {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, offset)));
                    const span = document.createElement('span');
                    span.className = globalMatchCount === activeMatchIndex ? 'find-highlight-active' : 'find-highlight';
                    span.textContent = match;
                    fragment.appendChild(span);
                    globalMatchCount++;
                    lastIndex = offset + match.length;
                });
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                textNode.parentNode.replaceChild(fragment, textNode);
            }
        });
        if (activeMatchIndex !== -1) { const activeHighlight = this.preview.querySelector('.find-highlight-active'); if (activeHighlight) activeHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }

    async save() {
        data[this.taskIndex].notes = this.textarea.value;
        data[this.taskIndex].date_updated = new Date().toISOString();
        localStorage.setItem("data", JSON.stringify(data));
        if (typeof data !== 'undefined') await this.imageStorage.cleanupOrphanedImages(data);
    }

    async saveAndClose() { try { await this.save(); this.close(); if (typeof createPost === 'function') createPost(); } catch (error) { console.error('Save and close failed:', error); } }

    close() {
        this.cleanupManager.cleanup();
        if (this.autoSave) this.autoSave.destroy();
        if (this.lazyImageLoader) this.lazyImageLoader.disconnect();
        if (this.dialog) { this.dialog.close(); this.dialog.remove(); }
    }

    applyAccessibilityPreferences() { if (window.matchMedia('(prefers-contrast: high)').matches) this.dialog.classList.add('high-contrast'); }

    toggleMinimize() {
        const isMinimized = this.dialog.classList.toggle('minimized');
        const titleEl = this.dialog.querySelector('.notes-task-title'), detailEl = this.dialog.querySelector('.notes-task-detail');
        if (isMinimized) {
            this.dialog.classList.remove('maximized');
            const title = this.task.title; titleEl.textContent = title.length > 18 ? title.substring(0, 18) + "..." : title;
            if (detailEl) detailEl.style.display = 'none';
        } else {
            titleEl.textContent = this.task.title; if (detailEl) detailEl.style.display = 'block';
            this.dialog.style.left = ''; this.dialog.style.transform = '';
        }
        MarkdownEditor.updateMinimizedPositions();
    }

    static updateMinimizedPositions() {
        const minimized = Array.from(document.querySelectorAll('.clsNotesModal.minimized'));
        if (minimized.length === 0) return;
        const gap = 10, width = 160, totalWidth = (minimized.length * width) + ((minimized.length - 1) * gap), startLeft = (window.innerWidth - totalWidth) / 2;
        minimized.forEach((dialog, index) => { dialog.style.left = `${startLeft + (index * (width + gap))}px`; dialog.style.right = 'auto'; dialog.style.transform = 'none'; });
    }

    toggleMaximize() { const isMaximized = this.dialog.classList.toggle('maximized'); if (isMaximized) { this.dialog.classList.remove('minimized'); const titleEl = this.dialog.querySelector('.notes-task-title'), detailEl = this.dialog.querySelector('.notes-task-detail'); titleEl.textContent = this.task.title; if (detailEl) detailEl.style.display = 'block'; } }

    bringToFront() { const others = document.querySelectorAll('.clsNotesModal'); let maxZ = 9000; others.forEach(d => { const z = parseInt(window.getComputedStyle(d).zIndex); if (!isNaN(z) && z > maxZ) maxZ = z; }); this.dialog.style.zIndex = maxZ + 1; }

    showHelpModal() {
        const shortcuts = [{ key: 'Ctrl + B', desc: 'Bold' }, { key: 'Ctrl + I', desc: 'Italic' }, { key: 'Ctrl + U', desc: 'Underline' }, { key: 'Ctrl + F', desc: 'Find / Replace' }, { key: 'Ctrl + Z', desc: 'Undo' }, { key: 'Ctrl + Y', desc: 'Redo' }, { key: 'Ctrl + S', desc: 'Save & Close' }, { key: 'Ctrl + Enter', desc: 'Save & Close' }, { key: 'Ctrl + H', desc: 'Show this Help' }, { key: 'Esc', desc: 'Close without saving' }];
        const specialTags = [{ key: '-a-', desc: 'Action Tag' }, { key: '-f-', desc: 'Finding Tag' }, { key: '-d-', desc: 'Documentation Tag' }, { key: '-q-', desc: 'Question/Blocker Tag' }];
        let helpDialog = document.getElementById('idNotesHelpDialog');
        if (!helpDialog) { helpDialog = document.createElement('dialog'); helpDialog.id = 'idNotesHelpDialog'; helpDialog.className = 'notes-help-dialog'; document.body.appendChild(helpDialog); }
        helpDialog.innerHTML = `
            <div class="help-content">
                <div class="help-header"><h3>Editor Guide</h3><button onclick="this.closest('dialog').close()" class="help-close-x">&times;</button></div>
                <div class="help-section"><h4>Keyboard Shortcuts</h4><div class="shortcut-list">${shortcuts.map(s => `<div class="shortcut-item"><span class="shortcut-key">${s.key}</span><span class="shortcut-desc">${s.desc}</span></div>`).join('')}</div></div>
                <div class="help-section"><h4>Special Tags</h4><p class="section-hint">Type these in <strong>Markdown</strong> or <strong>Editor</strong> mode:</p><div class="shortcut-list">${specialTags.map(t => `<div class="shortcut-item"><span class="shortcut-key tag-key">${t.key}</span><span class="shortcut-desc">${t.desc}</span></div>`).join('')}</div></div>
                <button onclick="this.closest('dialog').close()" class="help-close-btn">Got it</button>
            </div>
            <style>
                .notes-help-dialog { border: none; border-radius: 16px; padding: 0; background: var(--color-bg-container); color: var(--color-text-primary); box-shadow: 0 15px 35px rgba(0,0,0,0.3); max-width: 400px; width: 90%; overflow: hidden; }
                .help-content { padding: 24px; }
                .help-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .help-header h3 { margin: 0; color: var(--color-accent); font-size: 1.4em; }
                .help-close-x { background: none; border: none; color: var(--color-text-secondary); font-size: 24px; cursor: pointer; padding: 0; line-height: 1; }
                .help-section { margin-bottom: 24px; }
                .help-section h4 { margin: 0 0 12px 0; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); padding-bottom: 4px; }
                .section-hint { font-size: 0.8em; color: var(--color-text-secondary); margin-bottom: 10px; }
                .shortcut-list { display: flex; flex-direction: column; gap: 8px; }
                .shortcut-item { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
                .shortcut-key { font-weight: bold; background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 6px; font-family: 'Outfit', sans-serif; border: 1px solid var(--color-border); min-width: 45px; text-align: center; }
                .tag-key { background: var(--color-accent); color: white; border: none; }
                .shortcut-desc { color: var(--color-text-primary); flex: 1; margin-left: 15px; }
                .help-close-btn { width: 100%; padding: 12px; border: none; border-radius: 8px; background: var(--color-accent); color: white; cursor: pointer; font-weight: bold; transition: all 0.2s; }
                .help-close-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
                [data-theme="dark"] .shortcut-key { background: rgba(255,255,255,0.05); }
            </style>
        `;
        helpDialog.showModal();
    }

    showAutoSaveInfo() {
        const existingPopup = document.getElementById('idAutoSaveInfoPopup');
        if (existingPopup) { existingPopup.remove(); return; }
        const saveStatus = this.dialog.querySelector('#idSaveStatus');
        if (!saveStatus) return;
        const popup = document.createElement('div');
        popup.id = 'idAutoSaveInfoPopup';
        popup.className = 'auto-save-popup';
        popup.innerHTML = `
            <div class="auto-save-popup-content">
                <div class="auto-save-popup-header"><i class="material-icons">info</i><strong>Auto-Save</strong></div>
                <div class="auto-save-popup-body">
                    <p>Your notes are <strong>automatically saved</strong> as you type.</p>
                    <div class="auto-save-status-list">
                        <div class="auto-save-status-item"><i class="material-icons" style="color: #4CAF50;">check_circle</i><span><strong>Saved</strong> - All changes saved</span></div>
                        <div class="auto-save-status-item"><i class="material-icons" style="color: #FFC107;">sync</i><span><strong>Saving...</strong> - Currently saving</span></div>
                        <div class="auto-save-status-item"><i class="material-icons" style="color: #FF9800;">pending</i><span><strong>Unsaved</strong> - Changes pending</span></div>
                    </div>
                    <p class="auto-save-footer">Simply close the editor when you're done!</p>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        const rect = saveStatus.getBoundingClientRect();
        popup.style.position = 'fixed'; popup.style.bottom = `${window.innerHeight - rect.top + 10}px`; popup.style.right = `${window.innerWidth - rect.right}px`;
        const closePopup = (e) => { if (!popup.contains(e.target) && e.target !== saveStatus) { popup.remove(); document.removeEventListener('click', closePopup); } };
        setTimeout(() => { document.addEventListener('click', closePopup); }, 100);
        setTimeout(() => { if (popup.parentElement) { popup.remove(); document.removeEventListener('click', closePopup); } }, 8000);
    }

    handleCheckboxChange(e) {
        if (e.target.type === 'checkbox') {
            const isChecked = e.target.checked, indexInList = Array.from(this.preview.querySelectorAll('input[type="checkbox"]')).indexOf(e.target);
            let checkboxCount = 0;
            this.textarea.value = this.textarea.value.split('\n').map(line => line.replace(/\[[ x]\]/g, (match) => (checkboxCount++ === indexInList) ? (isChecked ? '[x]' : '[ ]') : match)).join('\n');
            this.autoSave.markDirty();
        }
    }

    handlePreviewKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            const block = e.target.closest('[data-line]'); if (!block) return;
            e.preventDefault();
            const selection = window.getSelection(); if (!selection.rangeCount) return;
            const range = selection.getRangeAt(0), lineIdx = parseInt(block.getAttribute('data-line')), lines = this.textarea.value.split('\n'), oldLine = lines[lineIdx] || "";
            const prefixMatch = oldLine.match(/^(\s*(?:#{1,6}|>|-(?!(?:-)|(?:\s*[adfq]-))|\*(?!\*))\s*(?:\[[ x]\]\s*)?)/), prefix = prefixMatch ? prefixMatch[1] : "";
            const beforeRange = range.cloneRange(); beforeRange.selectNodeContents(block); beforeRange.setEnd(range.startContainer, range.startOffset);
            const afterRange = range.cloneRange(); afterRange.selectNodeContents(block); afterRange.setStart(range.endContainer, range.endOffset);
            const divBefore = document.createElement('div'), divAfter = document.createElement('div');
            divBefore.appendChild(beforeRange.cloneContents()); divAfter.appendChild(afterRange.cloneContents());
            let beforeMd = this.htmlConverter.convert(divBefore.innerHTML, true, true), afterMd = this.htmlConverter.convert(divAfter.innerHTML, true, true);
            if (beforeMd.trim() === "" && afterMd.trim() === "" && prefix.trim().length > 0) {
                e.preventDefault();
                lines[lineIdx] = "";
                this.textarea.value = lines.join('\n');
                this.updatePreview(true).then(() => {
                    const block = this.preview.querySelector(`[data-line="${lineIdx}"]`);
                    if (block) {
                        block.focus();
                        this.setCaretOffset(block, 0);
                    }
                });
                return;
            }
            const isHeading = prefix.trim().startsWith('#');
            let nextPrefix = isHeading ? "" : prefix;
            let cleanAfterMd = afterMd;
            if (isHeading) cleanAfterMd = afterMd.replace(/^#+\s*/, '');

            lines[lineIdx] = (prefix && !beforeMd.startsWith(prefix) ? prefix : "") + beforeMd;
            lines.splice(lineIdx + 1, 0, nextPrefix + cleanAfterMd);
            this.textarea.value = lines.join('\n');
            this.updatePreview(true).then(() => { 
                const nextBlock = this.preview.querySelector(`[data-line="${lineIdx + 1}"]`); 
                if (nextBlock) { 
                    nextBlock.focus(); 
                    this.setCaretOffset(nextBlock, 0); 
                } 
            });
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            const block = e.target.closest('[data-line]'); if (!block) return;
            const selection = window.getSelection(); if (!selection.rangeCount || !selection.isCollapsed) return;
            const range = selection.getRangeAt(0), preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(block); preCaretRange.setEnd(range.startContainer, range.startOffset);
            const atStart = preCaretRange.toString().length === 0, postCaretRange = range.cloneRange();
            postCaretRange.selectNodeContents(block); postCaretRange.setStart(range.endContainer, range.endOffset);
            const atEnd = postCaretRange.toString().length === 0, caretRect = range.getBoundingClientRect(), blockRect = block.getBoundingClientRect();
            let isFirstLine = atStart, isLastLine = atEnd;
            if (caretRect.height > 0) { isFirstLine = caretRect.top <= (blockRect.top + 30); isLastLine = caretRect.bottom >= (blockRect.bottom - 30); }
            if ((e.key === 'ArrowLeft' && atStart) || (e.key === 'ArrowUp' && isFirstLine)) {
                const allBlocks = Array.from(this.preview.querySelectorAll('[data-line]')), currentIndex = allBlocks.indexOf(block);
                if (currentIndex > 0) { e.preventDefault(); const prevBlock = allBlocks[currentIndex - 1]; prevBlock.focus(); const newRange = document.createRange(); newRange.selectNodeContents(prevBlock); newRange.collapse(false); selection.removeAllRanges(); selection.addRange(newRange); }
            } else if ((e.key === 'ArrowRight' && atEnd) || (e.key === 'ArrowDown' && isLastLine)) {
                const allBlocks = Array.from(this.preview.querySelectorAll('[data-line]')), currentIndex = allBlocks.indexOf(block);
                if (currentIndex !== -1 && currentIndex < allBlocks.length - 1) { e.preventDefault(); const nextBlock = allBlocks[currentIndex + 1]; nextBlock.focus(); const newRange = document.createRange(); newRange.selectNodeContents(nextBlock); newRange.collapse(true); selection.removeAllRanges(); selection.addRange(newRange); }
            }
        }
        if (e.key === 'Backspace') {
            const block = e.target.closest('[data-line]'); if (!block) return;
            const selection = window.getSelection(); if (!selection.rangeCount || !selection.isCollapsed) return;
            const range = selection.getRangeAt(0), preRange = range.cloneRange();
            preRange.selectNodeContents(block); preRange.setEnd(range.startContainer, range.startOffset);
            
            if (preRange.toString().replace(/\u00A0/g, '').length === 0) {
                const lineIdx = parseInt(block.getAttribute('data-line'));
                if (isNaN(lineIdx)) return;
                
                const lines = this.textarea.value.split('\n');
                const oldLine = lines[lineIdx] || "";
                const prefixMatch = oldLine.match(/^(\s*(?:#{1,6}|>|-(?!(?:-)|(?:\s*[adfq]-))|\*(?!\*))\s*(?:\[[ x]\]\s*)?)/);
                const prefix = prefixMatch ? prefixMatch[1] : "";

                // STEP 1: If it's a special block (LI, H1, etc.), revert to normal text but keep the trigger characters
                if (prefix.length > 0 && block.tagName !== 'DIV' && block.tagName !== 'P') {
                    e.preventDefault();
                    document.execCommand('formatBlock', false, 'DIV');
                    // Force a sync to ensure the markdown is clean but contains the prefix text
                    this.syncEditorToMarkdown();
                    return;
                }

                // STEP 2 is handled by the browser (deleting prefix characters one by one in the DIV)

                // STEP 3: If the line is truly empty (no prefix, no text), merge with the previous line
                if (oldLine.length === 0 && lineIdx > 0) {
                    e.preventDefault();
                    const prevLine = lines[lineIdx - 1], prevLength = prevLine.length;
                    lines.splice(lineIdx, 1); 
                    this.textarea.value = lines.join('\n');
                    this.updatePreview().then(() => { 
                        const prevBlock = this.preview.querySelector(`[data-line="${lineIdx - 1}"]`); 
                        if (prevBlock) { prevBlock.focus(); this.setCaretOffset(prevBlock, prevLength); } 
                    });
                }
            }
        }
        if (e.key === 'Delete') {
            const block = e.target.closest('[data-line]'); if (!block) return;
            const selection = window.getSelection(); if (!selection.rangeCount || !selection.isCollapsed) return;
            const range = selection.getRangeAt(0), postRange = range.cloneRange();
            postRange.selectNodeContents(block); postRange.setStart(range.endContainer, range.endOffset);
            if (postRange.toString().replace(/\u00A0/g, '').length === 0) {
                const lineIdx = parseInt(block.getAttribute('data-line')), lines = this.textarea.value.split('\n');
                if (lineIdx < lines.length - 1) { e.preventDefault(); const offsetInBlock = this.getCaretOffset(block); lines[lineIdx] = lines[lineIdx] + lines[lineIdx + 1]; lines.splice(lineIdx + 1, 1); this.textarea.value = lines.join('\n'); this.updatePreview().then(() => { const currentBlock = this.preview.querySelector(`[data-line="${lineIdx}"]`); if (currentBlock) { currentBlock.focus(); this.setCaretOffset(currentBlock, offsetInBlock); } }); }
            }
        }
    }

    getCaretOffset(element) { const selection = window.getSelection(); if (!selection.rangeCount) return 0; const range = selection.getRangeAt(0), preCaretRange = range.cloneRange(); preCaretRange.selectNodeContents(element); preCaretRange.setEnd(range.endContainer, range.endOffset); return preCaretRange.toString().length; }
    setCaretOffset(element, offset) {
        const selection = window.getSelection(), range = document.createRange(); let currentOffset = 0, nodeFound = false;
        const traverse = (node) => {
            if (nodeFound) return;
            if (node.nodeType === 3) {
                const nextOffset = currentOffset + node.textContent.length;
                if (offset <= nextOffset) { range.setStart(node, offset - currentOffset); range.collapse(true); nodeFound = true; } else currentOffset = nextOffset;
            } else { for (let i = 0; i < node.childNodes.length; i++) { traverse(node.childNodes[i]); if (nodeFound) break; } }
        };
        traverse(element);
        if (!nodeFound) { range.selectNodeContents(element); range.collapse(false); }
        selection.removeAllRanges(); selection.addRange(range);
    }

    handleKeyboardShortcuts(e) {
        if (e.target.closest('.notes-toolbar')) {
            const buttons = Array.from(this.dialog.querySelectorAll('.notes-toolbar [tabindex="0"]')), index = buttons.indexOf(e.target);
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); buttons[e.key === 'ArrowRight' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length].focus(); return; }
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); return; }
        }
        if (!e.ctrlKey) return;
        let handled = true; const key = e.key.toLowerCase();
        if (key === 'b') this.handleToolbarAction('bold'); else if (key === 'i') this.handleToolbarAction('italic'); else if (key === 'u') this.handleToolbarAction('underline'); else if (key === 'z') this.handleToolbarAction('undo'); else if (key === 'y') this.handleToolbarAction('redo'); else if (key === 'f') this.handleToolbarAction('search'); else if (key === 'h') this.handleToolbarAction('help'); else if (key === 's') this.saveAndClose(); else if (e.key === 'Enter') this.saveAndClose(); else handled = false;
        if (handled) { e.preventDefault(); e.stopPropagation(); }
    }

    async handleExport(type) {
        const content = this.textarea.value, taskTitle = this.task.title.replace(/[^a-z0-9]/gi, '_');
        try {
            switch (type) {
                case 'markdown-file': this.downloadFile(content, `${taskTitle}.md`, 'text/markdown'); break;
                case 'text-file': this.downloadFile(this.convertToPlainText(content), `${taskTitle}.txt`, 'text/plain'); break;
                case 'pdf-file': await this.updatePreview(true); await new Promise(r => setTimeout(r, 100)); const wasEditor = this.currentView === 'editor'; if (wasEditor) { this.paneEditor.classList.add('hidden'); this.panePreview.classList.remove('hidden'); } window.print(); if (wasEditor) { this.paneEditor.classList.remove('hidden'); this.panePreview.classList.add('hidden'); } break;
                case 'copy-markdown': await navigator.clipboard.writeText(content); alert('Markdown copied to clipboard!'); break;
                case 'copy-text': await navigator.clipboard.writeText(this.convertToPlainText(content)); alert('Text copied to clipboard!'); break;
            }
        } catch (error) { console.error('Export failed:', error); alert('Export failed: ' + error.message); }
    }

    convertToPlainText(markdown) { return markdown.replace(/!\[.*?\]\(.*?\)/g, '[Image]').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/[*_~`#]/g, '').replace(/^[-*]\s/gm, '• ').replace(/^\d+\.\s/gm, '').replace(/^>\s/gm, '').replace(/^---$/gm, '─'.repeat(40)).replace(/<\/?u>/g, ''); }
    downloadFile(content, filename, mimeType) { const blob = new Blob([content], { type: mimeType }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
}

window.openFullscreenImage = (src) => {
    let overlay = document.getElementById('image-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('dialog'); overlay.id = 'image-fullscreen-overlay'; overlay.className = 'image-overlay';
        overlay.innerHTML = `<div class="image-container"><img src="${src}" alt="Fullscreen image"><button class="close-btn" aria-label="Close image" onclick="this.closest('dialog').close()">×</button></div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.close(); });
    } else overlay.querySelector('img').src = src;
    overlay.showModal();
};

function clkOpenTaskNotes(index) {
    const task = data[index]; if (!task) return;
    const editor = new MarkdownEditor(index, task);
    editor.open().catch(error => { console.error('Failed to open notes editor:', error); });
}

window.clkNoteTag = function (type) {
    const messages = { 'action': 'Action function coming soon', 'finding': 'Finding/Insight details coming soon', 'documentation': 'Link to documentation coming soon', 'question': 'Question/Blocker details coming soon' };
    if (typeof showToast === 'function') showToast(messages[type] || "Tag clicked", "info");
};

function parseMarkdown(text) { const parser = new MarkdownParser(); return parser.parse(text); }
async function initImageDB() { const storage = new ImageStorage(); await storage.init(); return storage; }
async function saveImageToDB(id, blob) { const storage = new ImageStorage(); await storage.saveImage(id, blob); }
async function getImageFromDB(id) { const storage = new ImageStorage(); return await storage.getImage(id); }
