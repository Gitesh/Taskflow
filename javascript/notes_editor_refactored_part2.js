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
              <textarea id="idNotesTextarea" aria-label="Markdown editor" placeholder="Type your notes here... Use # for headings, ** for bold, etc.">${this.task.notes || ""}</textarea>
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
        this.preview = document.getElementById("idNotesPreview");
        this.paneEditor = document.getElementById("paneEditor");
        this.panePreview = document.getElementById("panePreview");
        this.textSelection = new TextSelection(this.textarea);
    }

    setupAutoSave() {
        this.autoSave = new EditorAutoSave(this, 2000);
        const statusElement = document.getElementById("idSaveStatus");
        this.autoSave.setStatusElement(statusElement);
    }

    setupEventListeners() {
        // Debounced preview update
        const debouncedUpdate = debounce(() => this.updatePreview(), 300);
        this.cleanupManager.addEventListener(this.textarea, 'input', () => {
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
        } catch (error) {
            console.error('Preview update failed:', error);
        }
    }

    async resolveImages() {
        const images = this.preview.querySelectorAll('img[data-img-id]');
        for (const img of images) {
            const id = img.getAttribute('data-img-id');
            const blob = await this.imageStorage.getImage(id);
            if (blob) {
                const url = URL.createObjectURL(blob);
                img.src = url;
                this.cleanupManager.addBlobUrl(url);
            }
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
            // Preview is active - skip for now, would need Selection API implementation
            this.lastActiveElement.focus();
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
        const target = e.target;
        const lineIdx = target.getAttribute('data-line');
        if (lineIdx !== null) {
            const lines = this.textarea.value.split('\n');
            let htmlToMd = this.htmlConverter.convert(target.innerHTML);

            // Reconstruct the markdown line prefix if needed
            let prefix = "";
            const rawLine = lines[lineIdx].trim();
            if (rawLine.startsWith('# ')) prefix = "# ";
            else if (rawLine.startsWith('## ')) prefix = "## ";
            else if (rawLine.startsWith('### ')) prefix = "### ";
            else if (rawLine.startsWith('- [ ] ')) prefix = "- [ ] ";
            else if (rawLine.startsWith('- [x] ')) prefix = "- [x] ";
            else if (rawLine.startsWith('- ')) prefix = "- ";
            else if (rawLine.startsWith('* ')) prefix = "* ";

            lines[lineIdx] = prefix + htmlToMd;
            this.textarea.value = lines.join('\n');
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
