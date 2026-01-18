/*==================================*/
/* Task Notes & Markdown Support */
/*==================================*/

// --- IndexedDB for Images ---
const IMAGE_DB_NAME = 'TaskflowImages';
const IMAGE_STORE_NAME = 'images';
let imageDB = null;

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); // This is a data URL
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function initImageDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IMAGE_DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
                db.createObjectStore(IMAGE_STORE_NAME);
            }
        };
        request.onsuccess = (e) => {
            imageDB = e.target.result;
            resolve(imageDB);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

function saveImageToDB(id, blob) {
    return new Promise((resolve, reject) => {
        const transaction = imageDB.transaction([IMAGE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(IMAGE_STORE_NAME);
        const request = store.put(blob, id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function getImageFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = imageDB.transaction([IMAGE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(IMAGE_STORE_NAME);
        const request = store.get(id);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function getAllImagesFromDB() {
    return new Promise((resolve, reject) => {
        if (!imageDB) {
            initImageDB().then(() => doWork()).catch(reject);
        } else {
            doWork();
        }

        function doWork() {
            const transaction = imageDB.transaction([IMAGE_STORE_NAME], 'readonly');
            const store = transaction.objectStore(IMAGE_STORE_NAME);
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
        }
    });
}

// Global fullscreen viewer
window.openFullscreenImage = (src) => {
    let overlay = document.getElementById('image-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('dialog');
        overlay.id = 'image-fullscreen-overlay';
        overlay.onclick = () => overlay.close();
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<img src="${src}">`;
    overlay.showModal();
};

function clkOpenTaskNotes(index) {
    const task = data[index];
    if (!task) return;

    const existing = document.getElementById("idNotesModal");
    if (existing) {
        existing.close();
        existing.remove();
    }

    const myDialog = document.createElement("dialog");
    myDialog.id = "idNotesModal";
    myDialog.className = "clsNotesModal";
    document.body.appendChild(myDialog);

    // Determine priority color
    const headerColor = task.priority === 1 ? "var(--color-accent)" : "var(--color-primary)";

    myDialog.innerHTML = `
    <div class="notes-modal-content">
      <div class="notes-header" style="background: ${headerColor}">
        <div class="notes-header-left">
          <h2 class="notes-task-title">${task.title}</h2>
          <p class="notes-task-detail">${task.description}</p>
        </div>
        <div class="notes-header-right">
          <div class="notes-view-toggle">
            <button class="notes-toggle-btn" id="btnViewEditor">Editor</button>
            <button class="notes-toggle-btn active" id="btnViewSplit">Split</button>
            <button class="notes-toggle-btn" id="btnViewPreview">Preview</button>
          </div>
        </div>
      </div>

      <div class="notes-toolbar">
        <i class="material-icons" title="Undo (Ctrl+Z)" onmousedown="event.preventDefault()" onclick="handleToolbarAction('undo')">undo</i>
        <i class="material-icons" title="Redo (Ctrl+Y)" onmousedown="event.preventDefault()" onclick="handleToolbarAction('redo')">redo</i>
        <div class="notes-toolbar-divider"></div>
        <i class="material-icons" title="Bold (Ctrl+B)" onmousedown="event.preventDefault()" onclick="handleToolbarAction('bold')">format_bold</i>
        <i class="material-icons" title="Italic (Ctrl+I)" onmousedown="event.preventDefault()" onclick="handleToolbarAction('italic')">format_italic</i>
        <i class="material-icons" title="Underline (Ctrl+U)" onmousedown="event.preventDefault()" onclick="handleToolbarAction('underline')">format_underlined</i>
        <i class="material-icons" title="Strikethrough" onmousedown="event.preventDefault()" onclick="handleToolbarAction('strikethrough')">format_strikethrough</i>
        <i class="material-icons" title="Inline Code" onmousedown="event.preventDefault()" onclick="handleToolbarAction('code')">code</i>
        <div class="notes-toolbar-divider"></div>
        <i class="material-icons" title="Heading 1" onmousedown="event.preventDefault()" onclick="handleToolbarAction('header1')">filter_1</i>
        <i class="material-icons" title="Heading 2" onmousedown="event.preventDefault()" onclick="handleToolbarAction('header2')">filter_2</i>
        <i class="material-icons" title="Heading 3" onmousedown="event.preventDefault()" onclick="handleToolbarAction('header3')">filter_3</i>
        <div class="notes-toolbar-divider"></div>
        <i class="material-icons" title="Link" onmousedown="event.preventDefault()" onclick="clkInsertLink()">link</i>
        <i class="material-icons" title="Bullet List" onmousedown="event.preventDefault()" onclick="insertMarkdown('- ', '')">format_list_bulleted</i>
        <i class="material-icons" title="Task List" onmousedown="event.preventDefault()" onclick="insertMarkdown('[ ] ', '')">check_box</i>
        <i class="material-icons" title="Separator" onmousedown="event.preventDefault()" onclick="insertMarkdown('\\n---\\n', '')">horizontal_rule</i>
      </div>

      <div class="notes-editor-container">
        <div class="notes-editor-pane" id="paneEditor">
          <label>Notes (Markdown)</label>
          <textarea id="idNotesTextarea" placeholder="Type your notes here... Use # for headings, ** for bold, etc.">${task.notes || ""}</textarea>
        </div>
        <div class="notes-preview-pane" id="panePreview">
          <label>Preview</label>
          <div id="idNotesPreview">${parseMarkdown(task.notes || "")}</div>
        </div>
      </div>
      <div class="notes-footer">
        <button class="notes-btn-save" onclick="saveAndCloseNotes(${index})">Save & Close</button>
      </div>
    </div>
  `;

    myDialog.showModal();
    initImageDB().then(() => {
        updatePreview();
    });

    const textarea = document.getElementById("idNotesTextarea");
    const preview = document.getElementById("idNotesPreview");
    const paneEditor = document.getElementById("paneEditor");
    const panePreview = document.getElementById("panePreview");

    // Stable Render Function
    const updatePreview = async () => {
        const scrollPos = preview.scrollTop;
        preview.innerHTML = parseMarkdown(textarea.value);
        preview.scrollTop = scrollPos;
        await resolveImages();
    };

    // New: resolve tf-img:// references
    const resolveImages = async () => {
        const images = preview.querySelectorAll('img[data-img-id]');
        for (const img of images) {
            const id = img.getAttribute('data-img-id');
            const blob = await getImageFromDB(id);
            if (blob) {
                img.src = URL.createObjectURL(blob);
            }
        }
    };

    // View Toggles
    const setNotesView = (view) => {
        document.querySelectorAll('.notes-toggle-btn').forEach(b => b.classList.remove('active'));
        paneEditor.classList.remove('hidden');
        panePreview.classList.remove('hidden');

        if (view === 'editor') {
            panePreview.classList.add('hidden');
            document.getElementById('btnViewEditor').classList.add('active');
        } else if (view === 'preview') {
            paneEditor.classList.add('hidden');
            document.getElementById('btnViewPreview').classList.add('active');
        } else {
            document.getElementById('btnViewSplit').classList.add('active');
        }
    };

    document.getElementById('btnViewEditor').onclick = () => setNotesView('editor');
    document.getElementById('btnViewSplit').onclick = () => setNotesView('split');
    document.getElementById('btnViewPreview').onclick = () => setNotesView('preview');

    // Input sync
    textarea.addEventListener("input", updatePreview);

    // Paste handler for screenshots
    const handlePaste = async (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") !== -1) {
                const blob = item.getAsFile();
                const id = 'img_' + Date.now();
                await saveImageToDB(id, blob);

                const mdRef = `![screenshot](tf-img://${id})`;
                if (lastActiveElement === textarea) {
                    insertMarkdown(mdRef, "");
                } else {
                    // Preview pane paste
                    document.execCommand('insertText', false, mdRef);
                }
                updatePreview();
            }
        }
    };

    textarea.addEventListener("paste", handlePaste);
    preview.addEventListener("paste", handlePaste);

    // Track which pane was last interacted with
    let lastActiveElement = textarea;
    textarea.addEventListener('focus', () => lastActiveElement = textarea);
    preview.addEventListener('focusin', (e) => lastActiveElement = e.target);

    window.handleToolbarAction = (command) => {
        if (lastActiveElement === textarea) {
            textarea.focus();
            if (command === 'bold') insertMarkdown('**', '**');
            else if (command === 'italic') insertMarkdown('*', '*');
            else if (command === 'underline') insertMarkdown('<u>', '</u>');
            else if (command === 'strikethrough') insertMarkdown('~~', '~~');
            else if (command === 'code') insertMarkdown('`', '`');
            else if (command.startsWith('header')) {
                const level = command.replace('header', '');
                insertMarkdown('#'.repeat(parseInt(level)) + ' ', '');
            }
            else document.execCommand(command);
        } else {
            // Preview is active (contenteditable)
            lastActiveElement.focus();
            if (command === 'code') {
                const selection = window.getSelection();
                if (!selection.rangeCount) return;
                const range = selection.getRangeAt(0);
                const parent = range.commonAncestorContainer.parentElement;
                if (parent && parent.tagName === 'CODE') {
                    const text = document.createTextNode(parent.textContent);
                    parent.parentNode.replaceChild(text, parent);
                } else {
                    const code = document.createElement('code');
                    range.surroundContents(code);
                }
            } else if (command.startsWith('header')) {
                const level = command.replace('header', '');
                const tag = 'H' + level;
                const currentBlock = lastActiveElement.closest('[data-line]');
                if (currentBlock) {
                    const newTag = currentBlock.tagName === tag ? 'DIV' : tag;
                    const newEl = document.createElement(newTag);
                    newEl.innerHTML = currentBlock.innerHTML;
                    newEl.setAttribute('contenteditable', 'true');
                    newEl.setAttribute('data-line', currentBlock.getAttribute('data-line'));
                    currentBlock.parentNode.replaceChild(newEl, currentBlock);
                    lastActiveElement = newEl;
                    newEl.focus();
                }
            } else {
                document.execCommand(command, false, null);
            }
            // Trigger sync back to markdown
            const inputEvent = new Event('input', { bubbles: true });
            lastActiveElement.dispatchEvent(inputEvent);
        }
    };

    // Global helper for the toolbar (scoped to this dialog instance)
    window.insertMarkdown = (before, after) => {
        const b = before.replace(/\\n/g, '\n');
        const a = after.replace(/\\n/g, '\n');
        textarea.focus();

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);

        // Heading Toggle Logic
        if (b.startsWith('#')) {
            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = text.indexOf('\n', start);
            const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
            const lineContent = text.substring(lineStart, actualLineEnd);

            if (lineContent.startsWith(b)) {
                // Toggle off: remove heading prefix
                textarea.setSelectionRange(lineStart, lineStart + b.length);
                document.execCommand("insertText", false, "");
                textarea.setSelectionRange(start - b.length, end - b.length);
            } else {
                // Toggle on: replace existing heading or add new one
                const headingMatch = lineContent.match(/^#+\s/);
                if (headingMatch) {
                    textarea.setSelectionRange(lineStart, lineStart + headingMatch[0].length);
                    document.execCommand("insertText", false, b);
                } else {
                    textarea.setSelectionRange(lineStart, lineStart);
                    document.execCommand("insertText", false, b);
                }
            }
            updatePreview();
            return;
        }

        // Standard Wrapping Toggle Logic
        if (selectedText.startsWith(b) && selectedText.endsWith(a)) {
            // Unwrap
            const innerText = selectedText.substring(b.length, selectedText.length - a.length);
            document.execCommand("insertText", false, innerText);
            textarea.setSelectionRange(start, start + innerText.length);
        } else {
            // Check if selection is ALREADY wrapped by characters outside the selection
            const outerBefore = text.substring(start - b.length, start);
            const outerAfter = text.substring(end, end + a.length);

            if (outerBefore === b && outerAfter === a) {
                // Unwrap from outside
                textarea.setSelectionRange(start - b.length, end + a.length);
                document.execCommand("insertText", false, selectedText);
                textarea.setSelectionRange(start - b.length, start - b.length + selectedText.length);
            } else {
                // Wrap
                document.execCommand("insertText", false, b + selectedText + a);
                if (selectedText.length > 0) {
                    textarea.setSelectionRange(start + b.length, end + b.length);
                } else {
                    textarea.setSelectionRange(start + b.length, start + b.length);
                }
            }
        }

        updatePreview();
    };

    window.clkInsertLink = () => {
        if (lastActiveElement === textarea) {
            const url = prompt("Enter URL:", "https://");
            if (url) insertMarkdown("[", `](${url})`);
        } else {
            const url = prompt("Enter URL:", "https://");
            if (url) document.execCommand('createLink', false, url);
        }
    };

    // Keyboard Shortcuts for Modal (Unified)
    myDialog.addEventListener('keydown', (e) => {
        if (!e.ctrlKey) return;

        let handled = true;
        switch (e.key.toLowerCase()) {
            case 'b': handleToolbarAction('bold'); break;
            case 'i': handleToolbarAction('italic'); break;
            case 'u': handleToolbarAction('underline'); break;
            case 'z': handleToolbarAction('undo'); break;
            case 'y': handleToolbarAction('redo'); break;
            default: handled = false;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Handle interactive checkboxes in preview
    preview.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const isChecked = e.target.checked;
            const indexInList = Array.from(preview.querySelectorAll('input[type="checkbox"]')).indexOf(e.target);

            let checkboxCount = 0;
            const newText = textarea.value.split('\n').map(line => {
                return line.replace(/\[[ x]\]/g, (match) => {
                    if (checkboxCount === indexInList) {
                        checkboxCount++;
                        return isChecked ? '[x]' : '[ ]';
                    }
                    checkboxCount++;
                    return match;
                });
            }).join('\n');

            textarea.value = newText;
        }
    });

    // Handle Edit-in-Preview sync
    preview.addEventListener('input', (e) => {
        const target = e.target;
        const lineIdx = target.getAttribute('data-line');
        if (lineIdx !== null) {
            const lines = textarea.value.split('\n');
            let htmlToMd = target.innerHTML;

            // Convert rich text tags back to markdown
            htmlToMd = htmlToMd
                .replace(/<b>(.*?)<\/b>/gi, '**$1**')
                .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
                .replace(/<i>(.*?)<\/i>/gi, '*$1*')
                .replace(/<em>(.*?)<\/em>/gi, '*$1*')
                .replace(/<u>(.*?)<\/u>/gi, '<u>$1</u>')
                .replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~')
                .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
                .replace(/<code>(.*?)<\/code>/gi, '`$1`')
                .replace(/<img.*?data-img-id="(.*?)".*?>/gi, '![screenshot](tf-img://$1)')
                .replace(/<a.*?href="(.*?)".*?>(.*?)<\/a>/gi, '[$2]($1)')
                .replace(/&nbsp;/g, ' ')
                .replace(/<br>/gi, '')
                .replace(/<\/?[^>]+(>|$)/g, ""); // Final strip of any remaining tags

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
            textarea.value = lines.join('\n');
        }
    });

    // Handle Enter key in preview to create new lines in markdown
    preview.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const block = e.target.closest('[data-line]');
            if (!block) return;

            e.preventDefault();
            const lineIdx = parseInt(block.getAttribute('data-line'));
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const lines = textarea.value.split('\n');

            // Insert new line in textarea
            lines.splice(lineIdx + 1, 0, "");
            textarea.value = lines.join('\n');

            // Re-render preview to assign new data-line attributes
            updatePreview();

            // Focus the newly created line
            const focusNewLine = () => {
                const newBlock = preview.querySelector(`[data-line="${lineIdx + 1}"]`);
                if (newBlock) {
                    newBlock.focus();
                    const sel = window.getSelection();
                    const ran = document.createRange();
                    // If the block has text (due to split), or &nbsp;
                    if (newBlock.firstChild) {
                        ran.setStart(newBlock.firstChild, 0);
                    } else {
                        ran.setStart(newBlock, 0);
                    }
                    ran.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(ran);
                }
            };

            // Wait slightly for DOM to be ready after updatePreview (though sync, some browsers/drivers benefit)
            setTimeout(focusNewLine, 5);
        }
    });

    // Close on Escape - Save automatically
    myDialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            saveAndCloseNotes(index);
        }
    });

    // Handle click outside to close/save
    myDialog.addEventListener('click', (e) => {
        if (e.target === myDialog) {
            saveAndCloseNotes(index);
        }
    });
}

function saveAndCloseNotes(index) {
    const textarea = document.getElementById("idNotesTextarea");
    if (textarea) {
        data[index].notes = textarea.value;
        data[index].date_updated = new Date().toISOString();
        localStorage.setItem("data", JSON.stringify(data));
        // showToast("Notes saved", "success"); // Removed to avoid cluttering if closed via escape
    }
    const modal = document.getElementById("idNotesModal");
    if (modal) {
        modal.close();
        modal.remove();
    }
    // Re-render to ensure any data changes are reflected elsewhere if needed
    createPost();
}

function parseMarkdown(text) {
    if (!text) return "";

    const lines = text.split('\n');
    let htmlResult = [];
    let inList = false;

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
            .replace(/\[ \]/g, '<input type="checkbox">')
            .replace(/\[x\]/g, '<input type="checkbox" checked>')
            .replace(/-a-/gi, '<span class="note-tag action" contenteditable="false" onclick="clkNoteTag(\'action\')">action</span>')
            .replace(/-f-/gi, '<span class="note-tag finding" contenteditable="false" onclick="clkNoteTag(\'finding\')">finding</span>')
            .replace(/-d-/gi, '<span class="note-tag documentation" contenteditable="false" onclick="clkNoteTag(\'documentation\')">documentation</span>')
            .replace(/-q-/gi, '<span class="note-tag question" contenteditable="false" onclick="clkNoteTag(\'question\')">question</span>')
            .replace(/!\[(.*?)\]\(tf-img:\/\/(.*?)\)/g, '<img class="pasted-image" alt="$1" data-img-id="$2" onclick="openFullscreenImage(this.src)">')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/(^|[^"'])(https?:\/\/[^\s\)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    };

    lines.forEach((line, index) => {
        let rawLine = line.trim();

        // Horizontal Rule
        if (rawLine === '---' || rawLine === '***' || rawLine === '___') {
            if (inList) { htmlResult.push('</ul>'); inList = false; }
            htmlResult.push('<hr>');
            return;
        }

        if (rawLine === '' && !inList) {
            htmlResult.push(`<div contenteditable="true" data-line="${index}">&nbsp;</div>`);
            return;
        }

        // Headings
        if (rawLine.startsWith('# ')) {
            if (inList) { htmlResult.push('</ul>'); inList = false; }
            htmlResult.push(`<h1 contenteditable="true" data-line="${index}">${parseInline(rawLine.substring(2))}</h1>`);
        } else if (rawLine.startsWith('## ')) {
            if (inList) { htmlResult.push('</ul>'); inList = false; }
            htmlResult.push(`<h2 contenteditable="true" data-line="${index}">${parseInline(rawLine.substring(3))}</h2>`);
        } else if (rawLine.startsWith('### ')) {
            if (inList) { htmlResult.push('</ul>'); inList = false; }
            htmlResult.push(`<h3 contenteditable="true" data-line="${index}">${parseInline(rawLine.substring(4))}</h3>`);
        }
        // Lists & Task Lists
        else if (rawLine.startsWith('- ') || rawLine.startsWith('* ')) {
            if (!inList) {
                htmlResult.push('<ul>');
                inList = true;
            }
            const isTask = rawLine.includes('[ ]') || rawLine.includes('[x]');
            const content = parseInline(rawLine.substring(2));
            htmlResult.push(`<li class="${isTask ? 'is-task' : ''}" contenteditable="true" data-line="${index}">${content}</li>`);
        } else {
            if (inList) {
                htmlResult.push('</ul>');
                inList = false;
            }
            if (rawLine !== '') {
                htmlResult.push(`<div contenteditable="true" data-line="${index}">${parseInline(rawLine)}</div>`);
            }
        }
    });

    if (inList) htmlResult.push('</ul>');

    return htmlResult.join('');
}

// Global Note Tag Handler
window.clkNoteTag = function (type) {
    const messages = {
        'action': 'Action function coming soon',
        'finding': 'Finding/Insight details coming soon',
        'documentation': 'Link to documentation coming soon',
        'question': 'Question/Blocker details coming soon'
    };
    showToast(messages[type] || "Tag clicked", "info");
};
