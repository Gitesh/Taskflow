
//load elements into variables
let form = document.getElementById("form");
let input = document.getElementById("input");
//let msg = document.getElementById("idErrorMessage");

strDate = new Date();
strDate = strDate.toISOString();
strDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
strToday = new Date();

strToday = strDay[strToday.getDay()];


console.log("TASKFLOW STARTED:js loaded", strDate)

//Set the day of the week in the title to today
document.getElementById("idTaskflowTodaySubTitle").innerHTML = strToday;


////
// Check if user presses a shortcut key
// - Don't forget to add the shortcut key to the help dialog
// - Also add via a command to the /command pallette 
////

// --START-- Shortcut keys
window.addEventListener("keydown", function (event) {

  if (event.key === '+') { event.preventDefault(); document.getElementById('input').click() };
  if (event.ctrlKey && event.key === 'F') clkFlipToCountDownTimer();
  if (event.ctrlKey && event.key === 'B') clkToggleBackgroundAnimation();
  if (event.ctrlKey && event.key === 'P') clkFilterPendingTasks();
  if (event.ctrlKey && event.key === 'S') clkToggleSectionContainer();
  if (event.ctrlKey && event.key === '!') setView('view-standard');
  if (event.ctrlKey && event.key === '"') setView('view-kanban');
  if (event.ctrlKey && event.key === '£') setView('view-matrix');
  if (event.ctrlKey && event.key === '$') setView('view-dashboard');
  if (event.ctrlKey && event.key === 'L') toggleTheme();

  // Add New Task shortcut: Ctrl+Shift+A
  if (event.ctrlKey && event.shiftKey && (event.key === '+' || event.key === 'A' || event.key === 'a')) {
    event.preventDefault();
    input.value = '';
    input.focus();
    showToast('Add a new task', 'info');
  }
  // Upload File shortcut: Ctrl+Shift+U
  if (event.ctrlKey && event.shiftKey && (event.key === 'U' || event.key === 'u')) {
    event.preventDefault();
    // clkImportTasksFromLocalFile();
    clkUploadTasksToLocalStorage();
    showToast('Import tasks from file', 'info');
  }

  // Collapse/Expand All shortcut: Ctrl+Shift+C
  if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
    event.preventDefault();
    toggleCollapseAll();
    showToast('Toggled collapse/expand all', 'info');
  }

  // Toggle task preview: Ctrl+Shift+V
  if (event.ctrlKey && event.shiftKey && (event.key === 'V' || event.key === 'v')) {
    event.preventDefault();
    togglePreviewMode();
    showToast('Toggled task preview', 'info');
  }

  // Toggle tag visibility: Ctrl+Shift+G
  if (event.ctrlKey && event.shiftKey && (event.key === 'G' || event.key === 'g')) {
    event.preventDefault();
    clkToggleTagVisibility();
  }

  // Check if user is editing text
  const isEditing = document.activeElement.isContentEditable ||
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'TEXTAREA';

  if (event.key === '?' && !isEditing) clkSettings();

  // Command Palette: Activate input box with / for commands
  if (event.key === '/' && !isEditing) {
    event.preventDefault();
    const inputBox = document.getElementById('input');
    inputBox.value = '/';
    inputBox.focus();
    // Position cursor at the end instead of selecting text
    inputBox.setSelectionRange(1, 1);
  }


  console.log(`${event.type} has been fired`);
  console.log(`${event.key} key was pressed`);

});
// --END-- Shortcut keys

////
//Show Settings Panel
////

function clkSettings() {
  const existing = document.getElementById("idHelpModal");
  if (existing) {
    existing.close();
    existing.remove();
  }

  const myDialog = document.createElement("dialog");
  myDialog.id = "idHelpModal";
  document.body.appendChild(myDialog);

  // Close on Escape or clicking anywhere
  myDialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      myDialog.close();
      myDialog.remove();
    }
  });

  myDialog.addEventListener('click', () => {
    myDialog.close();
    myDialog.remove();
  });

  myDialog.innerHTML = `
    <div class="help-grid">
      <div class="help-column">
        <h3>Keyboard Shortcuts</h3>
        <ul>
          <h2> Functionality </h2>
            <li><code>CTRL+SHIFT+A</code> Add new task</li>
            <li><code>CTRL+SHIFT+F</code> Flip to timer</li>
            <li><code>CTRL+SHIFT+U</code> Upload file</li>
            <li><code>CTRL+SHIFT+P</code> Filter pending</li>
            <li><code>CTRL+SHIFT+C</code> Collapse/expand sections</li>
            <li><code>CTRL+SHIFT+V</code> Task preview</li>

          <h2> Aesthetic Toggles</h2>
            <li><code>CTRL+SHIFT+B</code> Background animation</li>
            <li><code>CTRL+SHIFT+S</code> Section visibility</li>
            <li><code>CTRL+SHIFT+L</code> Dark/Light theme</li>
            <li><code>CTRL+SHIFT+G</code> Tag visibility</li>

          <h2> Views </h2>
            <li><code>CTRL+SHIFT+1</code> Standard view</li>
            <li><code>CTRL+SHIFT+2</code> Kanban view</li>
            <li><code>CTRL+SHIFT+3</code> Matrix view</li>
            <li><code>CTRL+SHIFT+4</code> Dashboard view</li>

          </ul>
      </div>
      
      <div class="help-column">
        <h3>Command List</h3>
        <ul>
          <li><code>/flip</code> Toggle timer view</li>
          <li><code>/bg</code> or <code>/background</code> Toggle BG</li>
          <li><code>/pending</code> Filter pending tasks</li>
          <li><code>/export</code> Open export modal</li>
          <li><code>/collapse</code> Collapse sections</li>
          <li><code>/expand</code> Expand sections</li>
          <li><code>/preview</code> Toggle task preview</li>
          <li><code>/tags</code> Toggle tag visibility</li>
          <li><code>/dark</code> or <code>/light</code> Change theme</li>
          <li><code>/help</code> or <code>/settings</code> or <code>/?</code> This dialog</li>
        </ul>
      </div>
      
      <div class="help-column">
        <h3>General Tips</h3>
        <ul>
          <li><strong>Rename Sections</strong>: Double click a header to rename it.</li>
          <li><strong>Drag & Drop</strong>: Move tasks between sections freely.</li>
          <li><strong>Task Preview</strong>: Hover or use shortcut to see details.</li>
          <li><strong>Pomodoro</strong>: Flip the card to access the focus timer.</li>
          <li><strong>Audio Loops</strong>: Try the soundscapes on the timer side.</li>
        </ul>
      </div>
    </div>
    <div class="help-footer">
      <button class="help-btn-close">Close</button>
      <p>Press the space-bar or click to return</p>
    </div>
  `;

  myDialog.showModal();
}
function clkShowExportModal() {
  var myDialog = document.createElement("dialog");
  document.body.appendChild(myDialog);
  myDialog.setAttribute("id", "exportDialog");
  myDialog.setAttribute("onclick", "if(event.target === this) { this.close(); this.remove(); }");
  myDialog.setAttribute("onkeydown", "if (event.key === 'Escape') { this.close(); this.remove(); }");

  let title = document.createElement("h3");
  title.innerText = "Export Tasks";
  myDialog.appendChild(title);

  let btnCSV = document.createElement("button");
  btnCSV.innerText = "Export as CSV";
  btnCSV.style.cssText = "margin: 10px; padding: 10px; cursor: pointer;";
  btnCSV.onclick = function () { clkExportTasksToLocalFile(); myDialog.close(); myDialog.remove(); };
  myDialog.appendChild(btnCSV);

  let btnJSON = document.createElement("button");
  btnJSON.innerText = "Export as JSON";
  btnJSON.style.cssText = "margin: 10px; padding: 10px; cursor: pointer;";
  btnJSON.onclick = function () { clkExportTasksToJSON(); myDialog.close(); myDialog.remove(); };
  myDialog.appendChild(btnJSON);

  let closeMsg = document.createElement("p");
  closeMsg.innerText = "(Press Esc to close)";
  closeMsg.style.fontSize = "small";
  myDialog.appendChild(closeMsg);

  myDialog.style.cssText = "padding: 20px; font-family: sans-serif; background: black; color: cyan; opacity: 0.9; text-align:center; border: 1px solid cyan; border-radius: 10px;";

  myDialog.showModal();
}

// function closeSettingsDialog() {
//   document.getElementById('dialog').close();
//   document.getElementById('dialog').remove();
//   alert("rwar");

// };


//add event listener to the form to listen for the submit event
form.addEventListener("submit", (e) => {
  e.preventDefault();
  console.log("TASKFLOW: submit button clicked");

  //create formValidation function 
  formValidation();
});

// Reset input box on Escape key
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    input.value = '+add'; // Reset text
    input.blur();         // Remove focus
  }
});

//create formValidation function - if text box is empty show error
function formValidation() {
  const inputValue = input.value.trim();

  // Check if this is a command (starts with /)
  if (inputValue.startsWith('/')) {
    processCommand(inputValue);
    input.blur();
    input.value = "+add";
    return;
  }

  if (input.value === "+add" || inputValue === "") {
    // msg.innerHTML = "no text entered...";  //display error error message in div
    showToast("Type a title/outcome, or ESC to cancel", "error");

    console.log("ERROR: no text was entered");

  }
  else {
    console.log("OK: text was entered");

    //msg.innerHTML = ""; //clear error message dic

    acceptData(); // call the acceptData function

    input.blur(input.value = "+add"); //clear the input textbox

  }
}

// Command Palette Processor
function processCommand(command) {
  const cmd = command.toLowerCase().trim();

  switch (cmd) {
    case '/flip':
      clkFlipToCountDownTimer();
      showToast("Toggled timer view", "success");
      break;

    case '/background':
    case '/bg':
      clkToggleBackgroundAnimation();
      showToast("Toggled background animation", "success");
      break;

    case '/pending':
      clkFilterPendingTasks();
      showToast("Filtered pending tasks", "success");
      break;

    case '/settings':
    case '/?':
    case '/help':
      clkSettings();
      break;

    case '/export':
      clkShowExportModal();
      break;

    // Collapse/expand commands
    case '/collapse':
    case '/collapse-all':
      collapseAllSections();
      showToast('All sections collapsed', 'success');
      break;
    case '/expand':
    case '/expand-all':
      expandAllSections();
      showToast('All sections expanded', 'success');
      break;
    case '/preview':
    case '/toggle-preview':
      togglePreviewMode();
      showToast('Toggled task preview', 'success');
      break;
    case '/tags':
    case '/toggle-tags':
      clkToggleTagVisibility();
      break;

    case '/dark':
      setTheme('dark');
      break;

    case '/light':
      setTheme('light');
      break;


    default:
      showToast(`Unknown command: <br><br> ${cmd}. <br><br> Use /help to show available commands.`, "error");
      break;
  }

  console.log(`TASKFLOW: Executed command - ${cmd}`);
}


// View Management
const VALID_VIEWS = ['view-standard', 'view-kanban', 'view-matrix', 'view-dashboard'];

function setView(viewName) {
  if (!VALID_VIEWS.includes(viewName)) return;

  const targetElement = document.body; // Changed from idContainerAll to body to allow styling parents/global layout

  // Remove all view classes from body (new target)
  targetElement.classList.remove(...VALID_VIEWS);

  // Clean up legacy/previous view classes from idContainerAll if they exist
  const containerAll = document.getElementById('idContainerAll');
  if (containerAll) {
    containerAll.classList.remove(...VALID_VIEWS);
  }

  // Add new view class to body
  targetElement.classList.add(viewName);

  // Special handling for dashboard...
  if (viewName === 'view-dashboard') {
    // Apply details-open to the specific container if needed for internal logic
    if (containerAll) containerAll.classList.add('details-open');
    targetElement.classList.add('details-open');
  } else {
    if (containerAll) containerAll.classList.remove('details-open');
    targetElement.classList.remove('details-open');
  }

  // Persist preference
  localStorage.setItem('currentView', viewName);

  // Update active state of icons
  updateViewIconState(viewName);

  showToast(`Switched to ${viewName.replace('view-', '')} view`, 'success');

  //Simmer logo on view refresh
  document.getElementById('idTaskflowAppTitle').click();
  setTimeout(() => {
    document.getElementById('idTaskflowTodaySubTitle').click();
  }, 500);
}

function updateViewIconState(activeView) {
  // Find all view icons and update opacity or style
  const icons = document.querySelectorAll('#divIconBar .material-icons[onclick^="setView"]');
  icons.forEach(icon => {
    if (icon.getAttribute('onclick').includes(activeView)) {
      icon.style.color = 'var(--color-accent)'; // Highlight active
    } else {
      icon.style.color = ''; // Reset
    }
  });
}


// Theme Management
function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('theme', themeName);
  showToast(`Switched to ${themeName} mode`, 'success');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

// Load saved theme on init
(() => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();





// Toast Notification Function
function showToast(message, type = 'info') {
  // Check for open modals to append to (ensures visibility in Top Layer)
  const openModals = Array.from(document.querySelectorAll('dialog[open]'));
  const parentElement = openModals.length > 0 ? openModals[openModals.length - 1] : document.body;

  let container = parentElement.querySelector(':scope > #toast-container');

  // Create container if it doesn't exist under this parent
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    parentElement.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  const duration = 4000; // 4 seconds
  toast.className = `toast toast-${type}`;
  toast.style.setProperty('--toast-duration', `${duration}ms`);

  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
      <span class="material-icons" style="font-size: 18px;">close</span>
    </div>
    <div class="toast-progress-container">
      <div class="toast-progress-bar"></div>
    </div>
  `;

  // Allow clicking anywhere on the toast to dismiss it
  toast.onclick = function () {
    this.remove();
  };

  // Add to container
  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Auto remove after duration with pause/resume support
  let remainingTime = duration;
  let startTime;
  let timeoutId;
  let flashTimeoutId;
  let isEnding = false;

  function startTimer() {
    startTime = Date.now();

    // Final removal timeout
    timeoutId = setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 500);
    }, remainingTime);

    // Flashing threshold (at 30% of total duration)
    // If we haven't reached the 30% mark yet, schedule it
    const finishThreshold = duration * 0.3;
    if (!isEnding && remainingTime > finishThreshold) {
      flashTimeoutId = setTimeout(() => {
        isEnding = true;
        toast.classList.add('is-ending');
      }, remainingTime - finishThreshold);
    }
  }

  function pauseTimer() {
    clearTimeout(timeoutId);
    clearTimeout(flashTimeoutId);
    remainingTime -= Date.now() - startTime;
  }

  // Handle Pause on Hover
  toast.onmouseenter = pauseTimer;
  toast.onmouseleave = startTimer;

  // Initial Start
  startTimer();
}


//------
// V2 Data Model & Helpers
//------

const TaskModel = {
  create: (input) => {
    // Extract tags from description
    const tags = extractTagsFromText(input.description || "");

    // Map section to priority if not provided, or vice versa
    let priority = input.priority || 4;
    if (input.section) {
      const match = input.section.match(/div(\d)/);
      if (match) priority = parseInt(match[1]);
    }
    // Clamp priority 1-4
    priority = Math.max(1, Math.min(4, priority));

    return {
      id: input.id || Date.now().toString(),
      title: input.title || "Untitled Task",
      description: input.description || "",
      notes: input.notes || "",
      date_due: input.date_due || null,
      date_captured: input.date_captured || new Date().toISOString(),
      date_updated: new Date().toISOString(),
      date_closed: input.date_closed || null,
      status: input.status || "Pending", // Pending, In Progress, Completed, Cancelled, Deleted
      status_attrib: input.status_attrib || "",
      tags: tags, // Array of strings
      priority: priority,
      section: `div${priority}`, // Sync section with priority
      time_estimate_minutes: input.time_estimate_minutes || 0,
      time_logged_minutes: input.time_logged_minutes || 0,
      deleted: input.deleted || false,
      version: 2,
      subtasks: input.subtasks || []
    };
  }
};

function extractTagsFromText(text) {
  if (!text) return [];
  const matches = text.match(/#[a-z0-9_-]+/gi);
  if (!matches) return [];
  // value, index, self for unique
  return [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
}

function migrateTask(oldTask) {
  // If already V2, return
  if (oldTask.version === 2) return oldTask;

  // Combine title/detail if separated, or just map
  const description = oldTask.task_detail || "";

  // Combine existing csv tags + extracted tags
  let tags = [];
  if (oldTask.task_tag) {
    tags = oldTask.task_tag.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
  }
  const extracted = extractTagsFromText(description + " " + (oldTask.Task_Title || ""));
  tags = [...new Set([...tags, ...extracted])];

  // Map Status
  let status = oldTask.status || "Pending";
  if (status === "To Do") status = "Pending"; // V1 used "To Do" sometimes in json

  // Determine Priority/Section
  let section = oldTask.section || "div4";
  let priority = 4;
  const match = section.match(/div(\d)/);
  if (match) priority = parseInt(match[1]);

  return {
    id: oldTask.id,
    title: oldTask.Task_Title || "Untitled",
    description: description,
    notes: "",
    date_due: oldTask.date_due || null,
    date_captured: oldTask.date_captured || new Date().toISOString(),
    date_updated: new Date().toISOString(),
    date_closed: oldTask.date_closed || null,
    status: status,
    status_attrib: "Migrated",
    tags: tags,
    priority: priority,
    section: `div${priority}`,
    time_estimate_minutes: 0,
    time_logged_minutes: 0,
    deleted: false,
    version: 2,
    subtasks: oldTask.subtasks || []
  };
}

//------
// store input field into a new object called data
//------

// create empty data object to store tasks
let data = [];
let settings = {
  sections: {
    heading1: "High Impact",
    heading2: "Low Impact",
    heading3: "Delegate",
    heading4: "Ice Box"
  }
};

//create a function called accept data to store the input in the object named data
let acceptData = () => {

  // Use V2 Model
  const newTask = TaskModel.create({
    id: Date.now().toString(),
    title: input.value,
    description: "[Click edit to enter task detail] #tag",
    priority: 4, // Default to Ice Box
    status: "Pending"
  });

  data.push(newTask);
  localStorage.setItem("data", JSON.stringify(data));

  console.log("TASKFLOW acceptData +add: ", data);
  createPost();

  // Auto-focus on the task detail of the newly added task
  setTimeout(() => {
    // We rely on index-based ID for DOM because createPost (in its new form) will still use index for IDs
    const newTaskIndex = data.length - 1;
    const newTaskCard = document.getElementById(newTaskIndex.toString());

    if (newTaskCard) {
      const detailSpan = newTaskCard.querySelector('.clsTaskCardDetail');
      const editIcon = newTaskCard.querySelector('.clsTaskCardHoverIcons i[title="Edit details"]');
      if (detailSpan && editIcon) {
        clkCardEditTitleOrDetail(editIcon);
        detailSpan.innerHTML = ''; // Clear the placeholder text
        setTimeout(() => detailSpan.focus(), 10);
      }
    }
  }, 50);

};


//------
//publish the data as a new task
//------
let createPost = () => {
  // 0. Migration Check on Load or Update
  let needsSave = false;
  data = data.map(t => {
    if (t.version !== 2) {
      needsSave = true;
      return migrateTask(t);
    }
    return t;
  });

  // 1. Sort Data: Priority (1->4), then Due Date
  data.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (!a.date_due) return 1;
    if (!b.date_due) return -1;
    return new Date(a.date_due) - new Date(b.date_due);
  });

  if (needsSave) localStorage.setItem("data", JSON.stringify(data));

  // Clear dropboxes
  ["dropbox1", "dropbox2", "dropbox3", "dropbox4"].forEach(id => {
    document.getElementById(id).innerHTML = "";
  });

  data.forEach((task, index) => {
    // Skip deleted tasks
    if (task.deleted) return;

    // Filter logic (AND: Must have ALL selected tags)
    if (window.currentTagFilters.size > 0) {
      if (!task.tags || task.tags.length === 0) return;
      const hasAllTags = Array.from(window.currentTagFilters).every(filterTag => task.tags.includes(filterTag));
      if (!hasAllTags) return;
    }

    // Determine target
    let targetId = task.section ? task.section.replace("div", "dropbox") : "dropbox4";
    let target = document.getElementById(targetId) || document.getElementById("dropbox4");

    // Render Card
    target.innerHTML += renderTaskCard(task, index);
  });

  // Update previews
  try { updateAllSectionPreviews(); } catch (err) { /* ignore */ }
};

// Render Individual Task Card HTML
function renderTaskCard(task, index) {
  // Format dates
  const dueDate = task.date_due ? task.date_due.split('T')[0] : 'None';
  const createdDate = task.date_captured ? task.date_captured.split('T')[0] : 'Unknown';
  const closedDate = task.date_closed ? task.date_closed.split('T')[0] : 'None';
  const tagsHtml = renderTags(task.tags);
  const priority = task.priority || 4;

  // Note: We use 'index' as the DOM ID for drag/drop compatibility with existing functions
  // Ideally we should move to UID, but that requires updating drag/drop handlers.
  // For now, index is stable per render.

  return `
    <div id="${index}" data-task-uid="${task.id}" class="clsTaskCardWrapper priority-${priority}" draggable="true" ondragstart="drag(event)" ondragend="dragEnd(event)">
        <div class="clsTaskCardAll"> 
          
          <!-- FRONT FACE -->
          <div class="clsTaskCard">
            <span class="clsTaskCardTitle" ondblclick="clkCardEditTitleOrDetail(this.parentElement.querySelector('.clsTaskCardHoverIcons i[title=\\'Edit details\\']')); setTimeout(() => this.focus(), 10);">${task.title}</span>&nbsp - &nbsp
            <span class="clsTaskCardDetail" ondblclick="clkCardEditTitleOrDetail(this.parentElement.querySelector('.clsTaskCardHoverIcons i[title=\\'Edit details\\']')); setTimeout(() => this.focus(), 10);">${task.description}</span>

            <span class="clsTaskCardHoverIcons">
              <i onclick="clkCardEditTitleOrDetail(this)" title="Edit details" class="material-icons">edit</i>
              <i onclick="clkFlipTaskCardToForm(this)" title="Edit attributes" class="material-icons">edit_calendar</i>
              <i onclick="clkOpenTaskNotes(${index})" title="Task notes (Markdown)" class="material-icons">description</i>
              <i onclick="clkCardDeleteTask(this)" title="Delete this task" class="material-icons">delete</i>
            </span>
            
            <!-- Quick Tag Pills on Front (Validation) -->
            <div class="clsFrontTags" style="display: block; margin-top: 5px;">${tagsHtml}</div>
            
          </div> 

          <!-- BACK FACE -->
          <div class="clsTaskCardBack">
            <div class="clsTaskCardBackContainer">
              
              <div class="clsTaskCardGridLayout">
                
                <!-- Row 1 -->
                <div class="clsTaskCardBackField" onclick="toggleTaskFieldEdit(event, ${index}, 'date_due')">
                  <div class="clsTaskCardBackDisplay" id="display_date_due_${index}">
                    <span class="clsFieldLabel">Due</span> ${dueDate}
                  </div>
                  <input type="date" class="clsTaskCardBackInput hidden" id="input_date_due_${index}" value="${dueDate !== 'None' ? dueDate : ''}" onchange="updateTaskField(${index}, 'date_due', this.value); toggleTaskFieldEdit(null, ${index}, 'date_due');" onblur="toggleTaskFieldEdit(null, ${index}, 'date_due');">
                </div>

                <div class="clsTaskCardBackField" onclick="toggleTaskFieldEdit(event, ${index}, 'status');">
                  <div class="clsTaskCardBackDisplay" id="display_status_${index}">
                    <span class="clsFieldLabel">Status</span> ${task.status}
                  </div>
                  <select class="clsTaskCardBackInput hidden" id="input_status_${index}" onchange="updateTaskField(${index}, 'status', this.value); toggleTaskFieldEdit(null, ${index}, 'status');" onblur="toggleTaskFieldEdit(null, ${index}, 'status');">
                    <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Cancelled" ${task.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    <option value="Deleted" ${task.status === 'Deleted' ? 'selected' : ''}>Deleted</option>
                  </select>
                </div>

                <!-- Row 2 -->
                <div class="clsTaskCardBackField clsTaskCardBackFieldReadOnly">
                  <div class="clsTaskCardBackDisplay">
                    <span class="clsFieldLabel">Created</span> ${createdDate}
                  </div>
                </div>

                <div class="clsTaskCardBackField" onclick="toggleTaskFieldEdit(event, ${index}, 'priority')">
                  <div class="clsTaskCardBackDisplay" id="display_priority_${index}">
                    <span class="clsFieldLabel">Impact</span> ${getPriorityLabel(priority)}
                  </div>
                  <select class="clsTaskCardBackInput hidden" id="input_priority_${index}" onchange="updateTaskField(${index}, 'priority', this.value); toggleTaskFieldEdit(null, ${index}, 'priority');" onblur="toggleTaskFieldEdit(null, ${index}, 'priority');">
                     <option value="1" ${priority === 1 ? 'selected' : ''}>High (1)</option>
                     <option value="2" ${priority === 2 ? 'selected' : ''}>Medium (2)</option>
                     <option value="3" ${priority === 3 ? 'selected' : ''}>Low (3)</option>
                     <option value="4" ${priority === 4 ? 'selected' : ''}>None (4)</option>
                  </select>
                </div>

              </div> <!-- grid -->

              <!-- Tags & Return -->
              <div class="clsTaskCardTagsRow">
                 <div class="clsTaskCardBackField"> <!-- Read Only Tags -->
                    <div class="clsTaskCardBackDisplay">
                       <span class="clsFieldLabel">Tags</span> 
                       ${tagsHtml || "None (Add #hashes to desc)"}
                    </div>
                 </div>

                <div class="clsTaskCardBackFieldButton">
                  <span class="material-icons" onclick="clkFlipTaskCardToTask(this)" title="Return">keyboard_double_arrow_right</span>
                </div>
              </div>

            </div>
          </div> 
        </div> <!-- all -->
    </div>`;
}

function getPriorityLabel(p) {
  if (p === 1) return "High";
  if (p === 2) return "Medium";
  if (p === 3) return "Low";
  return "Ice Box";
}

function renderTags(tags) {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return "";
  return tags.map(tag => {
    const isActive = window.currentTagFilters.has(tag) ? 'active' : '';
    return `<span class="clsTag ${isActive}" onclick="clkFilterByTag('${tag}', event)">${tag}</span>`;
  }).join('');
}

// Global Filter State (Set of strings)
window.currentTagFilters = new Set();

function clkFilterByTag(tag, event) {
  if (event) event.stopPropagation();

  // Toggle logic
  if (window.currentTagFilters.has(tag)) {
    window.currentTagFilters.delete(tag);
    showToast(`Filter removed: #${tag}`, "info");
  } else {
    window.currentTagFilters.add(tag);
    showToast(`Filter added: #${tag}`, "success");
  }

  updateFilterIconState();
  createPost(); // Re-render
}

function clkClearTagFilter() {
  window.currentTagFilters.clear();
  showToast("Filters cleared", "info");
  updateFilterIconState();
  createPost();
}

function updateFilterIconState() {
  const btn = document.getElementById('btnClearFilter');
  if (btn) {
    btn.style.display = window.currentTagFilters.size > 0 ? 'inline-block' : 'none';
  }
}

// Function to update single fields from card back
function updateTaskField(index, field, value) {
  // Update Data Model
  if (field.startsWith('date_') && value) {
    data[index][field] = new Date(value).toISOString();
  } else if (field === 'priority') {
    const p = parseInt(value);
    data[index].priority = p;
    data[index].section = `div${p}`; // Sync section
  } else if (field === 'status') {
    data[index].status = value;
    if (value === 'Deleted') {
      data[index].deleted = true;
    }
  } else {
    data[index][field] = value;
  }

  localStorage.setItem("data", JSON.stringify(data));
  createPost(); // Re-render completely to handle Move (priority change) or Tag updates
}



// Toggle between display and edit mode for task card back fields
function toggleTaskFieldEdit(event, index, fieldName) {
  const displayEl = document.getElementById(`display_${fieldName}_${index}`);
  const inputEl = document.getElementById(`input_${fieldName}_${index}`);

  if (!displayEl || !inputEl) return;

  // If event exists, it's a click to edit
  if (event) {

    // Only hide the display and show input if not already editing
    if (!inputEl.classList.contains('hidden')) {
      return; // Already in edit mode
    }

    // Get the field label and preserve it
    const labelEl = displayEl.querySelector('.clsFieldLabel');
    const labelText = labelEl ? labelEl.textContent : '';

    displayEl.classList.add('hidden');
    inputEl.classList.remove('hidden');
    inputEl.focus();

    // Open the control immediately where possible so a single click activates it
    const tag = inputEl.tagName;
    const type = (inputEl.type || '').toLowerCase();

    if (tag === 'SELECT') {
      // Defer the click so the element is focusable and the dropdown opens
      setTimeout(() => {
        try {
          inputEl.focus();
          inputEl.click();
        } catch (err) {
          // ignore
        }
      }, 0);
    } else if (tag === 'INPUT') {
      // For date/time pickers prefer showPicker() when available, otherwise click()
      if (type === 'date' || type === 'time' || type === 'datetime-local' || type === 'month' || type === 'week') {
        if (typeof inputEl.showPicker === 'function') {
          try { inputEl.showPicker(); } catch (err) { inputEl.click(); }
        } else {
          inputEl.click();
        }
      } else if (type === 'text' || type === 'search' || type === 'tel' || type === 'url') {
        // select the text for quick editing
        if (typeof inputEl.select === 'function') inputEl.select();
      }
    }
  } else {
    // Called from input change/blur - switch back to display mode
    inputEl.classList.add('hidden');
    displayEl.classList.remove('hidden');
  }
}


function clkFlipTaskCardToForm(e) {
  //var cardID = e.parentElement.parentElement.parentElement.parentElement.id; //get the index id from the parent div
  //console.log("TASKFLOW: ", cardID);
  //  console.log(e.parentElement.parentElement.parentElement.classList);// this is the clsTasKCardAll span

  var setClassToFlipped = e.closest('.clsTaskCardAll');
  setClassToFlipped.classList.toggle("is-flipped");
}


function clkFlipTaskCardToTask(e) {

  var setClassToUnFlipped = e.closest('.clsTaskCardAll');
  setClassToUnFlipped.classList.toggle("is-flipped");


  // const setFrontToInvisible = document.getElementsByClass("clsContainerFront");
  // setFrontToInvisible.style.visibility = 'hidden';

  // const setBackToVisible = document.getElementsByClass("clsContainerBack");
  // setBackVisible.style.visibility = 'visible';

  // console.log("TASKFLOW setFrontToInvisible: ",setFrontToInvisible);
  // console.log("TASKFLOW setBackToVisible: ",setBackToVisible);

}


////////
//
// Flip container
//
////////
function clkFlipToCountDownTimer() {
  const containerAll = document.getElementById("idContainerAll");
  containerAll.classList.toggle("is-flipped");

  // Scroll to top smoothly after a tiny delay to ensure the flip has started
  setTimeout(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, 100); // 100ms delay is enough — adjust to 0 if you want instant

  console.log("TASKFLOW: clkFlipToCountDownTimer");
}


//immediately invoked function expression to reload tasks
(() => {
  // Load data
  data = JSON.parse(localStorage.getItem("data")) || [];
  // Migration for old data
  data.forEach(task => {
    if (!task.section) task.section = "div4";
    if (!task.status || task.status === "Open" || task.status === "Closed") {
      task.status = "Pending";
    }
  });

  // Load Settings
  let storedSettings = JSON.parse(localStorage.getItem("settings"));
  if (storedSettings) {
    settings = storedSettings;
    // Apply headers
    Object.keys(settings.sections).forEach(id => {
      let el = document.getElementById(id);
      if (el) el.innerText = settings.sections[id];
    });
  }

  console.log("json loaded: ", data);
  createPost();

  // Initialize collapsed sections from localStorage
  try {
    const collapsed = JSON.parse(localStorage.getItem('collapsedSections') || '{}');
    Object.keys(collapsed).forEach(secId => {
      if (collapsed[secId]) {
        const el = document.getElementById(secId);
        if (el && el.classList) el.classList.add('collapsed');
      }
    });
  } catch (err) {
    // ignore
  }
  // Initialize preview mode from localStorage
  try {
    const pm = JSON.parse(localStorage.getItem('sectionPreviewMode') || 'false');
    setPreviewMode(!!pm);
  } catch (err) {
    // ignore
  }
  // Update collapse-all button state
  try { updateCollapseAllButton(); } catch (err) { /* ignore */ }

  // Initialize View
  try {
    const savedView = localStorage.getItem('currentView') || 'view-standard';
    setView(savedView);
  } catch (err) {
    console.error("Error setting view:", err);
  }

})();

// Toggle collapse/expand for a section and persist state
function toggleSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.classList.toggle('collapsed');

  // Save collapsed sections map
  const collapsed = JSON.parse(localStorage.getItem('collapsedSections') || '{}');
  collapsed[sectionId] = el.classList.contains('collapsed');
  localStorage.setItem('collapsedSections', JSON.stringify(collapsed));
  // Update preview for this section (if preview mode enabled)
  updateSectionPreview(sectionId);
  // Update collapse-all button state
  try { updateCollapseAllButton(); } catch (err) { /* ignore */ }
}

// Preview mode state
let previewMode = false;

function setPreviewMode(enabled) {
  previewMode = !!enabled;
  localStorage.setItem('sectionPreviewMode', JSON.stringify(previewMode));
  const btn = document.getElementById('btnPreviewMode');
  if (btn) btn.classList.toggle('active', previewMode);
  // Refresh previews
  updateAllSectionPreviews();
}

function togglePreviewMode() {
  setPreviewMode(!previewMode);
}

function updateAllSectionPreviews() {
  ['div1', 'div2', 'div3', 'div4'].forEach(id => updateSectionPreview(id));
}

function updateSectionPreview(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const header = section.querySelector('.sectionHeader');
  if (!header) return;
  let previewEl = header.querySelector('.sectionPreview');
  if (!previewEl) {
    previewEl = document.createElement('span');
    previewEl.className = 'sectionPreview';
    header.appendChild(previewEl);
  }

  const dropbox = section.querySelector('[id^="dropbox"]');
  const count = dropbox ? dropbox.children.length : 0;

  // if (section.classList.contains('collapsed') && previewMode) {
  if (previewMode) {
    // show a one-line preview using the first task title
    let firstTitle = '';
    if (dropbox) {
      const firstCardTitle = dropbox.querySelector('.clsTaskCardTitle');
      if (firstCardTitle) firstTitle = firstCardTitle.textContent.trim();
    }
    if (firstTitle) {
      previewEl.textContent = `(${count}) ${firstTitle}`;
    } else {
      previewEl.textContent = `(${count})`;
    }
    previewEl.style.display = 'inline';
  } else {
    previewEl.style.display = 'none';
  }
}

// Collapse / Expand All helpers
function collapseAllSections() {
  const ids = ['div1', 'div2', 'div3', 'div4'];
  const collapsed = JSON.parse(localStorage.getItem('collapsedSections') || '{}');
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('collapsed')) el.classList.add('collapsed');
    collapsed[id] = true;
  });
  localStorage.setItem('collapsedSections', JSON.stringify(collapsed));
  updateAllSectionPreviews();
  updateCollapseAllButton();
}

function expandAllSections() {
  const ids = ['div1', 'div2', 'div3', 'div4'];
  const collapsed = JSON.parse(localStorage.getItem('collapsedSections') || '{}');
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.classList.contains('collapsed')) el.classList.remove('collapsed');
    collapsed[id] = false;
  });
  localStorage.setItem('collapsedSections', JSON.stringify(collapsed));
  updateAllSectionPreviews();
  updateCollapseAllButton();
}

function toggleCollapseAll() {
  // If any section is NOT collapsed, collapse all. Otherwise expand all.
  const ids = ['div1', 'div2', 'div3', 'div4'];
  let anyOpen = false;
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('collapsed')) anyOpen = true;
  });
  if (anyOpen) collapseAllSections(); else expandAllSections();
}

function updateCollapseAllButton() {
  const ids = ['div1', 'div2', 'div3', 'div4'];
  let allCollapsed = true;
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('collapsed')) allCollapsed = false;
  });
  const btn = document.getElementById('btnCollapseAll');
  if (!btn) return;
  // If all collapsed, show expand icon; otherwise show collapse icon
  if (allCollapsed) {
    btn.innerText = 'expand_more';
    btn.classList.add('active');
  } else {
    btn.innerText = 'expand_less';
    btn.classList.remove('active');
  }
}


////////
// Edit headings on double click. Sets content to editable for a short time
////////
function listenForDoubleClick(element) {
  element.contentEditable = true;
  element.focus();

  // Save on blur
  element.onblur = function () {
    element.contentEditable = false;
    // Save new text
    let id = element.id;
    if (settings.sections[id] !== undefined) {
      settings.sections[id] = element.innerText;
      localStorage.setItem("settings", JSON.stringify(settings));
      showToast("Section name saved", "success");
    }
  };
}

//------
//delete a post function
//------

//see createPost function, where parent of the delete button is the span with the classnane 'clsTaskCard' which shows the icons.

// let deletePost = (e) => {
//     e.parentElement.parentElement.remove();
// };  

function clkCardDeleteTask(e) {
  //e.parentElement.parentElement.remove(); // Removed visual remove, relying on createPost reflow logic which is cleaner

  // Find index from wrapper ID
  let wrapper = e.closest('.clsTaskCardWrapper');
  let id = wrapper.id;

  data.splice(id, 1);

  localStorage.setItem("data", JSON.stringify(data));

  createPost(); // Re-render to fix indices
};



//------
// add a new card
//------

// --- DRAG AND DROP IMPLEMENTATION ---

/**
 * Triggered when the user starts dragging a task card.
 * Stores the index of the task being dragged.
 */
// --- ENHANCED DRAG AND DROP WITH SEPARATION ---

// --- SMOOTH DRAG AND DROP LOGIC ---

// --- SMOOTH DRAG AND DROP LOGIC (LASER LINE) ---

function drag(ev) {
  const taskUID = ev.currentTarget.getAttribute('data-task-uid');
  ev.dataTransfer.setData("text/plain", taskUID);

  // Delay adding the class so the "ghost" image remains visible
  setTimeout(() => ev.target.classList.add('dragging'), 0);
  ev.dataTransfer.effectAllowed = "move";
}

function allowDrop(ev) {
  ev.preventDefault();
  const dropArea = ev.target.closest('.clsDropArea');
  if (!dropArea) return;

  dropArea.classList.add('drag-over');

  // Insert Laser Line
  updateDropLine(dropArea, ev.clientY);
}

function updateDropLine(dropArea, mouseY) {
  // 1. Get all cards in this section containing our laser line
  const cards = [...dropArea.querySelectorAll('.clsTaskCardWrapper:not(.dragging)')];
  const dropbox = dropArea.querySelector('[id^="dropbox"]');

  // 2. Determine insertion point
  const nextCard = cards.find(card => {
    const box = card.getBoundingClientRect();
    return mouseY < box.top + box.height / 2;
  });

  // 3. Find or Create Laser Line
  let line = document.getElementById('idLaserLine');
  if (!line) {
    line = document.createElement('div');
    line.id = 'idLaserLine';
    line.className = 'drop-line';
  }

  // 4. Position the line only if it's not already there
  if (line.nextElementSibling !== nextCard || line.parentElement !== dropbox) {
    if (nextCard) {
      dropbox.insertBefore(line, nextCard); // Place before the card we are hovering
    } else {
      dropbox.appendChild(line); // Place at the end if no next card found
    }
  }
}

function dragLeave(ev) {
  const dropArea = ev.target.closest('.clsDropArea');
  const relatedTarget = ev.relatedTarget;

  // Only remove if we really left the drop area (not just entered a child element)
  if (dropArea && !dropArea.contains(relatedTarget)) {
    dropArea.classList.remove('drag-over');
    removeDropLine();
  }
}

function removeDropLine() {
  const line = document.getElementById('idLaserLine');
  if (line) line.remove();
}

function drop(ev) {
  ev.preventDefault();
  const taskUID = ev.dataTransfer.getData("text/plain");
  const dropArea = ev.target.closest('.clsDropArea');

  // Clean up visual cues
  removeDropLine();
  if (dropArea) dropArea.classList.remove('drag-over');

  if (!dropArea || !taskUID) return;

  const targetSectionId = dropArea.id;

  // Find the insertion point using the same logic as the laser line
  const cards = [...dropArea.querySelectorAll('.clsTaskCardWrapper:not(.dragging)')];
  const nextCard = cards.find(card => {
    const box = card.getBoundingClientRect();
    return ev.clientY < box.top + box.height / 2;
  });

  // 1. Find the task object in the data array
  const taskIndex = data.findIndex(t => t.id === taskUID);
  if (taskIndex === -1) return;

  const [movedTask] = data.splice(taskIndex, 1);

  // 2. Update section
  movedTask.section = targetSectionId;

  // 3. Find new array position
  if (nextCard) {
    const nextUID = nextCard.getAttribute('data-task-uid');
    const newIndex = data.findIndex(t => t.id === nextUID);
    data.splice(newIndex, 0, movedTask);
  } else {
    data.push(movedTask);
  }

  // 4. Save and Re-render
  localStorage.setItem("data", JSON.stringify(data));
  createPost();
  showToast("Position updated", "success");
}

function dragEnd(ev) {
  ev.target.classList.remove('dragging');
  document.querySelectorAll('.clsDropArea').forEach(da => da.classList.remove('drag-over'));
  removeDropLine();
}

//-------------------
// edit front of card
//-------------------
// Updated 2026-01-03_0041 

function clkCardEditTitleOrDetail(e) {
  const editTitle = e.parentElement.previousElementSibling.previousElementSibling;
  const editDetail = e.parentElement.previousElementSibling;

  // Store original values BEFORE editing (critical!)
  const originalTitle = editTitle.innerHTML;
  const originalDetail = editDetail.innerHTML;

  // Enable editing
  editTitle.setAttribute("contenteditable", "true");
  editDetail.setAttribute("contenteditable", "true");
  editTitle.setAttribute("class", "clsTaskCardTitleEdit");
  editDetail.setAttribute("class", "clsTaskCardDetailEdit");

  editTitle.focus();

  const cardID = editTitle.parentElement.parentElement.parentElement.id;

  // Save function (Ctrl+Enter or click outside)
  const saveAndExit = () => {
    editTitle.setAttribute("contenteditable", "false");
    editDetail.setAttribute("contenteditable", "false");
    editTitle.setAttribute("class", "clsTaskCardTitle");
    editDetail.setAttribute("class", "clsTaskCardDetail");

    // V2 Update Logic
    data[cardID].title = editTitle.innerHTML.trim();
    data[cardID].description = editDetail.innerHTML.trim();
    // Regenerate tags
    data[cardID].tags = extractTagsFromText(data[cardID].description + " " + data[cardID].title);

    localStorage.setItem("data", JSON.stringify(data));
    console.log("TASKFLOW: Saved task", cardID);

    // We must re-render to show updated tags/titles correctly in case of side effects
    createPost();

    document.onkeydown = null;
    document.removeEventListener("click", handleClickOutside);
  };

  // Discard function (Escape)
  const discardAndExit = () => {
    editTitle.innerHTML = originalTitle;
    editDetail.innerHTML = originalDetail;

    editTitle.setAttribute("contenteditable", "false");
    editDetail.setAttribute("contenteditable", "false");
    editTitle.setAttribute("class", "clsTaskCardTitle");
    editDetail.setAttribute("class", "clsTaskCardDetail");

    console.log("TASKFLOW: Changes discarded for task", cardID);

    document.onkeydown = null;
    document.removeEventListener("click", handleClickOutside);
  };

  // Keyboard handling
  document.onkeydown = function (event) {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      saveAndExit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      discardAndExit();
    }
  };

  // Click outside = save (you can change this to discardAndExit() if preferred)
  const handleClickOutside = (event) => {
    const isClickInside = editTitle.contains(event.target) || editDetail.contains(event.target);
    if (!isClickInside) {
      saveAndExit();  // ← Change to discardAndExit() if you want discard on click outside
    }
  };

  setTimeout(() => {
    document.addEventListener("click", handleClickOutside);
  }, 0);
}

////
// Toggle JS and CSS background
////
function clkToggleBackgroundAnimation() {

  var setJSAnimatedBackgroundOnOff = document.getElementsByTagName("Canvas")[0];

  if (setJSAnimatedBackgroundOnOff.style.display === "none") {

    setJSAnimatedBackgroundOnOff.style.display = "block";  // make visible JS background

    let s = document.createElement('link');               // make visible css background
    s.rel = 'stylesheet';
    s.type = 'text/css';
    s.id = 'idAnimatedBackgroundCSSStylesheet'
    s.href = 'animated_background/shapes.css';
    document.getElementsByTagName('head')[0].appendChild(s);


  } else {
    setJSAnimatedBackgroundOnOff.style.display = "none";  // remove javascript background

    document.querySelector('link[href$="shapes.css"]').remove() // remove css background
    // container.classList.add('background-enabled');

  }

};

function clkToggleTagVisibility() {
  document.body.classList.toggle('hide-tags');
  const isHidden = document.body.classList.contains('hide-tags');
  localStorage.setItem('hideTags', isHidden);

  const btn = document.getElementById('btnToggleTags');
  if (btn) btn.classList.toggle('active', isHidden);

  showToast(isHidden ? "Tags hidden" : "Tags visible", "info");
}

// Initialize tag visibility on load
(function () {
  const isHidden = localStorage.getItem('hideTags') === 'true';
  if (isHidden) {
    document.body.classList.add('hide-tags');
    const btn = document.getElementById('btnToggleTags');
    if (btn) btn.classList.add('active');
  }
})();

//////
// hide container and leave sections
/////
function clkToggleSectionContainer() {
  var container = document.querySelector('.clsContainerAll');

  if (container.classList.contains('background-enabled')) {
    container.classList.remove('background-enabled');
  } else {
    container.classList.add('background-enabled');
  };

};



function clkExportTasksToLocalFile() {
  console.log("Exporting tasks from localStorage");
  showToast("Exporting tasks from localStorage to CSV file", "info");

  // Get data from localStorage
  var exportData = JSON.parse(localStorage.getItem("data")) || [];

  if (exportData.length === 0) {
    showToast("No tasks to export", "error");
    return;
  }
  // Use first element to choose the keys and the order
  var keys = Object.keys(exportData[0]);
  // Build header with COMMA delimiter
  var csvContent = keys.join(",") + "\n";
  // Add the rows
  exportData.forEach(function (obj) {
    csvContent += keys.map(k => {
      let val = obj[k];

      // Handle arrays/objects -> Semicolon separated string
      if (Array.isArray(val)) {
        return `"${val.join(';')}"`;
      } else if (typeof val === 'object' && val !== null) {
        return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      }

      // Handle strings with commas or quotes
      let strVal = String(val || '');
      if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
        return `"${strVal.replace(/"/g, '""')}"`;
      }

      return strVal;
    }).join(",") + "\n";
  });
  console.log("CSV Content:", csvContent);
  //Download the <timestamp>Taskflow.csv file
  var hiddenElement = document.createElement('a');
  hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  hiddenElement.target = '_blank';

  //provide the name for the CSV file to be downloaded  
  hiddenElement.download = Date.now() + '_Taskflow.csv';
  hiddenElement.click();
  showToast("Tasks exported successfully!", "success");
};

async function clkExportTasksToJSON() {
  console.log("Exporting tasks from localStorage to JSON");
  showToast("Preparing full backup (including images)...", "info");

  var exportData = JSON.parse(localStorage.getItem("data")) || [];
  var exportSettings = JSON.parse(localStorage.getItem("settings")) || {};

  if (exportData.length === 0) {
    showToast("No tasks to export", "error");
    return;
  }

  // Fetch images from IndexedDB
  let imageBackup = {};
  if (typeof getAllImagesFromDB === 'function') {
    try {
      const images = await getAllImagesFromDB();
      for (const id in images) {
        imageBackup[id] = await blobToBase64(images[id]);
      }
    } catch (err) {
      console.error("Failed to export images:", err);
      showToast("Warning: Some images could not be backed up", "warning");
    }
  }

  // Create full state object
  var fullState = {
    meta: {
      version: "2.1", // Bumped version for image support
      exported_at: new Date().toISOString()
    },
    settings: exportSettings,
    tasks: exportData,
    images: imageBackup
  };

  var jsonContent = JSON.stringify(fullState, null, 2);

  var hiddenElement = document.createElement('a');
  hiddenElement.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonContent);
  hiddenElement.target = '_blank';

  hiddenElement.download = Date.now() + '_Taskflow_Backup.json';
  hiddenElement.click();
  showToast("Full backup exported successfully!", "success");
}

/* Note: Notes logic moved to notes_editor.js */






////////
//
// STUB: Show Pending Tasks View
//
////////

function clkFilterPendingTasks() {
  showToast("INFO:Stub for pending tasks", "info");
  showToast("WARNING: Stub for pending tasks", "warning");
  showToast("ERROR: Stub for pending tasks", "error");
  showToast("SUCCESS: Stub for pending tasks", "success");
  showToast("LIGHT: Stub for pending tasks", "light");
};




////////
// Upload CSV into local storage
////////

//new upload code 2025-07-08
function clkUploadTasksToLocalStorage() {
  console.log("CLICKED - stub for file upload");

  var fileInput = document.getElementById("uploadCSV");

  // Define the readFile function
  var readFile = function () {
    var reader = new FileReader();
    var file = fileInput.files[0];

    reader.onload = function (e) {
      let content = e.target.result;

      // Try to parse as JSON first
      try {
        let json = JSON.parse(content);

        // Handle New Format (Object with tasks/settings/images)
        if (json.tasks && Array.isArray(json.tasks)) {
          localStorage.setItem("data", JSON.stringify(json.tasks));

          if (json.settings) {
            localStorage.setItem("settings", JSON.stringify(json.settings));
          }

          // Restore images to IndexedDB
          if (json.images && typeof initImageDB === 'function') {
            initImageDB().then(async () => {
              for (const id in json.images) {
                try {
                  const blob = await fetch(json.images[id]).then(res => res.blob());
                  await saveImageToDB(id, blob);
                } catch (err) {
                  console.error("Failed to restore image:", id, err);
                }
              }
              showToast("Imported Full State (with images) successfully", "success");
              setTimeout(() => document.location.reload(), 1000);
            });
            return; // Exit here as reload happens in then()
          }

          showToast("Imported Full State successfully", "success");
          setTimeout(() => document.location.reload(), 1000);
          return;
        }

        // Handle Legacy Format (Array only)
        if (Array.isArray(json)) {
          localStorage.setItem("data", JSON.stringify(json));
          showToast("Imported Legacy JSON successfully", "success");
          setTimeout(() => document.location.reload(), 1000);
          return;
        }

      } catch (err) {
        // Not JSON, assume CSV
        console.log("Not JSON, attempting CSV import...");
        convertCSVtoJSON(content);
      }
    };

    // Read as text
    reader.readAsText(file, 'UTF-8');
  };

  fileInput.onclick = function () { this.value = null; }; // Allow re-uploading same file
  fileInput.onchange = readFile;
  fileInput.click(); // Trigger file dialog
}

//NEW CONVERTCSVTOJSON 2025-07-08
function convertCSVtoJSON(uploadedCSV) {
  //lop off any trailing or starting whitespace
  csv = uploadedCSV.trim();

  const lines = csv.split('\n');
  const headers = lines[0].split(',').map(h => h.trim()); // Assume comma for standard CSV
  const output = [];

  for (let i = 1; i < lines.length; i++) {
    const rowValues = [];
    let currentVal = '';
    let inQuote = false;
    for (let charIndex = 0; charIndex < lines[i].length; charIndex++) {
      let char = lines[i][charIndex];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        rowValues.push(currentVal);
        currentVal = '';
        continue;
      }
      currentVal += char;
    }
    rowValues.push(currentVal); // push last value

    // Clean up quotes
    const cleanValues = rowValues.map(v => {
      let val = v.trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1).replace(/""/g, '"');
      }
      return val;
    });

    // Safety check
    if (cleanValues.length < 1) continue;

    const obj = {};
    for (let k = 0; k < headers.length; k++) {
      let key = headers[k];
      let value = cleanValues[k] || '';
      obj[key] = value;
    }

    // Default new fields if missing
    if (!obj.section) obj.section = "div4";
    if (!obj.status) obj.status = "Open";
    if (!obj.subtasks) obj.subtasks = [];
    if (!obj.id) obj.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);

    output.push(obj);
  }

  // Store the uploaded data into local storage replacing data object
  localStorage.setItem("data", JSON.stringify(output));
  console.log("TASKFLOW convert data: ", output);
  showToast("Imported CSV successfully", "success");
  setTimeout(() => document.location.reload(), 1000);

  return output;
}



////////
//  play the audio loop which is selected by passing the div
////////
function clkPlayAudio(sound) {

  // console.log("TASKFLOW: playaudio",sound); 

  var audioElement = document.getElementById(sound);

  console.log("TASKFLOW audioelement: ", audioElement);
  if (audioElement.paused) {
    audioElement.play();
    //      console.log("TASKFLOW audio element play: ",audioElement);


    //--change the icon colour, selected as the sibling element of the audio
    var strChildElement = document.getElementById(sound).nextElementSibling;

    strChildElement.style.color = "black";

    //      console.log("Taskflow child:", strChildElement);


  }
  else {
    audioElement.pause();  //pause the audio loop

    //  console.log("TASKFLOW audio element pause: ",audioElement);

    //--change the icon colour--
    var strChildElement = document.getElementById(sound).nextElementSibling;

    strChildElement.style.color = "grey";

    //  console.log("Taskflow child:", strChildElement);
  }

};


////
// 2026-01-05 Updates the dashboard detail pane with task information.
// Cleaned for security and maintainability.
///

function selectTaskForDashboard(card) {
  if (!document.body.classList.contains('view-dashboard')) return;

  const detailPane = document.getElementById('idDetailPane');
  if (!detailPane) return;

  // 1. Data Extraction (Safe)
  const title = card.querySelector('.clsTaskCardTitle')?.textContent || 'Untitled Task';
  const detail = card.querySelector('.clsTaskCardDetail')?.textContent || 'No details provided.';
  const date = card.querySelector('.clsTaskInfo')?.textContent || '';
  const tag = card.querySelector('.clsTaskTag')?.textContent || '';

  // Find status from the nearest section header
  const sectionHeader = card.closest('.clsDropArea')?.querySelector('.sectionHeader');
  const status = sectionHeader ? sectionHeader.textContent.trim() : 'Unknown';

  // 2. UI Updates: Highlight active card
  const activeClass = 'active';
  document.querySelector(`.clsTaskCardWrapper.${activeClass}`)?.classList.remove(activeClass);
  card.closest('.clsTaskCardWrapper')?.classList.add(activeClass);

  // 3. Build Content Safely
  // We set the structure first, then use textContent to inject data
  detailPane.innerHTML = `
    <h3 class="pane-title"></h3>
    <div class="pane-meta">
        <span class="clsTaskTag pane-tag"></span>
        <span class="pane-date"></span>
    </div>
    <div class="pane-description-box">
        <p class="pane-description"></p>
    </div>
    <p><strong>Status:</strong> <span class="pane-status"></span></p>
    <div class="pane-actions">
         <button class="btnEditDetails btn-primary">Edit Task</button>
    </div>
  `;

  // Inject text safely to prevent XSS
  detailPane.querySelector('.pane-title').textContent = title;
  detailPane.querySelector('.pane-tag').textContent = tag;
  detailPane.querySelector('.pane-date').textContent = date;
  detailPane.querySelector('.pane-description').textContent = detail;
  detailPane.querySelector('.pane-status').textContent = status;

  // 4. Edit Handler logic
  const editIcon = card.querySelector('.clsTaskCardHoverIcons i[title="Edit details"]');
  const editBtn = detailPane.querySelector('.btnEditDetails');

  if (editIcon && editBtn) {
    editBtn.onclick = () => editIcon.click();
  }
}




// Attach click listeners to cards global or via delegation
// We can use the existing drag/drop or global click handler
const taskListContainer = document.getElementById('idTaskListContainer');
if (taskListContainer) {
  taskListContainer.addEventListener('click', function (e) {
    const cardWrapper = e.target.closest('.clsTaskCardWrapper');
    if (cardWrapper && document.body.classList.contains('view-dashboard')) {
      // Don't override edit/delete buttons
      const targetTag = e.target.tagName.toLowerCase();
      if (targetTag === 'i' || targetTag === 'button') return;

      const card = cardWrapper.querySelector('.clsTaskCard');
      selectTaskForDashboard(card);
    }
  });
}


//-------------------------------------------------------------------------
// TITLE TILT AND GLINT ANIMATION
//-------------------------------------------------------------------------

/**
 * Add click event listeners to title elements for tilt and glint animation
 */
function addGlintOnClick() {
  const titles = [
    document.getElementById('idTaskflowAppTitle'),
    document.getElementById('idTaskflowTodaySubTitle')
  ];

  titles.forEach(title => {
    if (!title) return;
    title.addEventListener('click', function () {
      // Remove class first to allow re-trigger
      this.classList.remove('glint-active');

      // Force reflow to restart animation
      void this.offsetWidth;
      this.classList.add('glint-active');
    });
  });
}

// Call it on load
addGlintOnClick();
document.getElementById('idTaskflowAppTitle').click();
document.getElementById('idTaskflowTodaySubTitle').click();