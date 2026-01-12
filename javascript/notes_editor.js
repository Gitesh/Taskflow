/*==================================*/
/* Task Notes & Markdown Support */
/*==================================*/

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
        <i class="material-icons" title="Bold (Ctrl+B)" onclick="insertMarkdown('**', '**')">format_bold</i>
        <i class="material-icons" title="Italic (Ctrl+I)" onclick="insertMarkdown('*', '*')">format_italic</i>
        <i class="material-icons" title="Heading 1" onclick="insertMarkdown('# ', '')">filter_1</i>
        <i class="material-icons" title="Heading 2" onclick="insertMarkdown('## ', '')">filter_2</i>
        <i class="material-icons" title="Heading 3" onclick="insertMarkdown('### ', '')">filter_3</i>
        <div class="notes-toolbar-divider"></div>
        <i class="material-icons" title="Bullet List" onclick="insertMarkdown('- ', '')">format_list_bulleted</i>
        <i class="material-icons" title="Task List" onclick="insertMarkdown('[ ] ', '')">check_box</i>
        <i class="material-icons" title="Separator" onclick="insertMarkdown('\\n---\\n', '')">horizontal_rule</i>
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

    const textarea = document.getElementById("idNotesTextarea");
    const preview = document.getElementById("idNotesPreview");
    const paneEditor = document.getElementById("paneEditor");
    const panePreview = document.getElementById("panePreview");

    // Stable Render Function
    const updatePreview = () => {
        const scrollPos = preview.scrollTop;
        preview.innerHTML = parseMarkdown(textarea.value);
        preview.scrollTop = scrollPos;
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

    // Global helper for the toolbar (scoped to this dialog instance)
    window.insertMarkdown = (before, after) => {
        const b = before.replace(/\\n/g, '\n');
        const a = after.replace(/\\n/g, '\n');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        const newText = text.substring(0, start) + b + selectedText + a + text.substring(end);

        textarea.value = newText;
        textarea.focus();
        textarea.selectionStart = start + b.length;
        textarea.selectionEnd = end + b.length;

        updatePreview();
    };

    // Keyboard Shortcuts for Modal
    textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            insertMarkdown('**', '**');
        }
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            insertMarkdown('*', '*');
        }
    });

    // Handle interactive checkboxes in preview
    preview.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const isChecked = e.target.checked;
            const indexInList = Array.from(preview.querySelectorAll('input[type="checkbox"]')).indexOf(e.target);

            let checkboxCount = 0;
            const newText = textarea.value.replace(/\[[ x]\]/g, (match) => {
                if (checkboxCount === indexInList) {
                    checkboxCount++;
                    return isChecked ? '[x]' : '[ ]';
                }
                checkboxCount++;
                return match;
            });

            textarea.value = newText;
            // Note: We don't call updatePreview() here to avoid the "jump" while the user is clicking.
            // The DOM is already updated by the native click, and the textarea is synced in background.
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
            .replace(/\[ \]/g, '<input type="checkbox">')
            .replace(/\[x\]/g, '<input type="checkbox" checked>');
    };

    lines.forEach(line => {
        let rawLine = line.trim();

        // Horizontal Rule
        if (rawLine === '---' || rawLine === '***' || rawLine === '___') {
            if (inList) { htmlResult.push('</ul>'); inList = false; }
            htmlResult.push('<hr>');
            return;
        }

        if (rawLine === '' && !inList) {
            htmlResult.push('<br>');
            return;
        }

        // Headings
        if (rawLine.startsWith('# ')) {
            if (inList) { htmlResult.push('</ul>'); inList = false; }
            htmlResult.push(`<h1>${parseInline(rawLine.substring(2))}</h1>`);
        } else if (rawLine.startsWith('## ')) {
            if (inList) { htmlResult.push('</ul>'); inList = false; }
            htmlResult.push(`<h2>${parseInline(rawLine.substring(3))}</h2>`);
        } else if (rawLine.startsWith('### ')) {
            if (inList) { htmlResult.push('</ul>'); inList = false; }
            htmlResult.push(`<h3>${parseInline(rawLine.substring(4))}</h3>`);
        }
        // Lists & Task Lists
        else if (rawLine.startsWith('- ') || rawLine.startsWith('* ')) {
            if (!inList) {
                htmlResult.push('<ul>');
                inList = true;
            }
            const isTask = rawLine.includes('[ ]') || rawLine.includes('[x]');
            const content = parseInline(rawLine.substring(2));
            htmlResult.push(`<li class="${isTask ? 'is-task' : ''}">${content}</li>`);
        } else {
            if (inList) {
                htmlResult.push('</ul>');
                inList = false;
            }
            if (rawLine !== '') {
                htmlResult.push(`<div>${parseInline(rawLine)}</div>`);
            }
        }
    });

    if (inList) htmlResult.push('</ul>');

    return htmlResult.join('');
}
