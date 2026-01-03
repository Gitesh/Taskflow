
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
// check for shortcut keys
////

// --START-- Shortcut keys
window.addEventListener("keydown", function (event) {

  if (event.key === '+') { event.preventDefault(); document.getElementById('input').click() };
  if (event.ctrlKey && event.key === 'F') clkFlipToCountDownTimer();
  if (event.ctrlKey && event.key === 'B') clkToggleBackgroundAnimation();
  if (event.ctrlKey && event.key === 'P') clkFilterPendingTasks();
  if (event.ctrlKey && event.key === 'S') clkToggleSectionContainer();

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
          <li><code>CTRL+SHIFT+A</code> Add new task</li>
          <li><code>CTRL+SHIFT+F</code> Flip to timer</li>
          <li><code>CTRL+SHIFT+B</code> Toggle BG animation</li>
          <li><code>CTRL+SHIFT+P</code> Filter Pending</li>
          <li><code>CTRL+SHIFT+U</code> Upload file</li>
          <li><code>CTRL+SHIFT+C</code> Collapse/Expand all</li>
          <li><code>CTRL+SHIFT+V</code> Toggle task preview</li>
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

    case '/dark':
      setTheme('dark');
      break;

    case '/light':
      setTheme('light');
      break;


    default:
      showToast(`Unknown command: <br>/test/+<br> ${cmd}. <br><br> Try /help for available commands.`, "error");
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
  let container = document.getElementById('toast-container');

  // Create container if it doesn't exist
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
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
      setTimeout(() => toast.remove(), 300);
    }, remainingTime);

    // Flashing threshold (at 50% of total duration)
    // If we haven't reached the 50% mark yet, schedule it
    const finishThreshold = duration * 0.5;
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
//store input field into a new object called data
//------

//create empty data object to store tasks
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

  data.push({
    id: Date.now().toString(), // Unique ID for reliable referencing
    Task_Title: data["Task_Title"] = input.value,
    task_detail: data["task_detail"] = "[Click edit to enter task detail]",
    date_due: "",
    date_captured: strDate,
    date_closed: "",
    task_tag: "career",
    section: "div4", // Default to Ice Box
    status: "Pending", // Pending, In Progress, Completed, Cancelled
    subtasks: [] // Future proofing
  })

  localStorage.setItem("data", JSON.stringify(data));

  console.log("TASKFLOW acceptData +add: ", data)

  createPost();

  // Auto-focus on the task detail of the newly added task
  setTimeout(() => {
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
  // Clear all dropboxes
  document.getElementById("dropbox1").innerHTML = "";
  document.getElementById("dropbox2").innerHTML = "";
  document.getElementById("dropbox3").innerHTML = "";
  document.getElementById("dropbox4").innerHTML = "";

  data.forEach((x, y) => {
    // Determine target dropbox based on section
    let targetId = "dropbox4"; // Default
    if (x.section) {
      // Map divX to dropboxX
      targetId = x.section.replace("div", "dropbox");
    }

    let target = document.getElementById(targetId);
    if (!target) target = document.getElementById("dropbox4"); // Fallback

    target.innerHTML += `
    <div id="${y}" data-task-uid="${x.id}" class="clsTaskCardWrapper" draggable="true" ondragstart="drag(event)" ondragend="dragEnd(event)">
        <div class="clsTaskCardAll" > <!-- 3d object  |||| clsTaskCardAll -->
          <div class="clsTaskCard">

            <span class="clsTaskCardTitle" ondblclick="clkCardEditTitleOrDetail(this.parentElement.querySelector('.clsTaskCardHoverIcons i[title=\\'Edit details\\']')); setTimeout(() => this.focus(), 10);">${x.Task_Title}</span>&nbsp - &nbsp
            <span class="clsTaskCardDetail" ondblclick="clkCardEditTitleOrDetail(this.parentElement.querySelector('.clsTaskCardHoverIcons i[title=\\'Edit details\\']')); setTimeout(() => this.focus(), 10);">${x.task_detail}</span>

            <span class="clsTaskCardHoverIcons">
              <i onclick="clkCardEditTitleOrDetail(this)" title="Edit details" class="material-icons">edit</i>
              <i onclick="clkFlipTaskCardToForm(this)" title="Edit attributes" class="material-icons">edit_calendar</i>
              <i onclick="clkCardDeleteTask(this)" title="Delete this task" class="material-icons">delete</i>
            </span>

          </div> <!-- front face clsTaskCard-->



          <div class="clsTaskCardBack">
            <div class="clsTaskCardBackContainer">
              
              <!-- 3-Row Layout with inline labels and values -->
              <div class="clsTaskCardGridLayout">
                
                <!-- Row 1: Due Date and Status -->
                <div class="clsTaskCardBackField" onclick="toggleTaskFieldEdit(event, ${y}, 'date_due')">
                  <div class="clsTaskCardBackDisplay" id="display_date_due_${y}">
                    <span class="clsFieldLabel">Due</span> ${x.date_due ? x.date_due.split('T')[0] : 'None'}
                  </div>
                  <input type="date" class="clsTaskCardBackInput hidden" id="input_date_due_${y}" value="${x.date_due ? x.date_due.split('T')[0] : ''}" onchange="updateTaskField(${y}, 'date_due', this.value); toggleTaskFieldEdit(null, ${y}, 'date_due');" onblur="toggleTaskFieldEdit(null, ${y}, 'date_due');">
                </div>

                <div class="clsTaskCardBackField" onclick="toggleTaskFieldEdit(event, ${y}, 'status');">
                  <div class="clsTaskCardBackDisplay" id="display_status_${y}">
                    <span class="clsFieldLabel">Status</span> ${x.status || 'None'}
                  </div>
                  <select class="clsTaskCardBackInput hidden" id="input_status_${y}" onchange="updateTaskField(${y}, 'status', this.value); toggleTaskFieldEdit(null, ${y}, 'status');" onblur="toggleTaskFieldEdit(null, ${y}, 'status');">
                    <option value="Pending" ${x.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${x.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${x.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Cancelled" ${x.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                  </select>
                </div>

                <!-- Row 2: Created Date and Closed Date -->
                <div class="clsTaskCardBackField clsTaskCardBackFieldReadOnly">
                  <div class="clsTaskCardBackDisplay" id="display_date_captured_${y}">
                    <span class="clsFieldLabel">Created</span> ${x.date_captured ? x.date_captured.split('T')[0] : 'Unknown'}
                  </div>
                </div>

                <div class="clsTaskCardBackField" onclick="toggleTaskFieldEdit(event, ${y}, 'date_closed')">
                  <div class="clsTaskCardBackDisplay" id="display_date_closed_${y}">
                    <span class="clsFieldLabel">Closed</span> ${x.date_closed ? x.date_closed.split('T')[0] : 'None'}
                  </div>
                  <input type="date" class="clsTaskCardBackInput hidden" id="input_date_closed_${y}" value="${x.date_closed ? x.date_closed.split('T')[0] : ''}" onchange="updateTaskField(${y}, 'date_closed', this.value); toggleTaskFieldEdit(null, ${y}, 'date_closed');" onblur="toggleTaskFieldEdit(null, ${y}, 'date_closed');">
                </div>

              </div>

              <!-- Row 3: Tags (outside grid) and Flip Button -->
              
              <div class="clsTaskCardTagsRow">
                <div class="clsTaskCardBackField" onclick="toggleTaskFieldEdit(event, ${y}, 'task_tag')">
                  <div class="clsTaskCardBackDisplay" id="display_task_tag_${y}">
                    <span class="clsFieldLabel">Tags</span> ${x.task_tag || 'None'}
                  </div>
                  <input type="text" class="clsTaskCardBackInput hidden" id="input_task_tag_${y}" value="${x.task_tag}" onchange="updateTaskField(${y}, 'task_tag', this.value); toggleTaskFieldEdit(null, ${y}, 'task_tag');" onblur="toggleTaskFieldEdit(null, ${y}, 'task_tag');">
                </div>

                <div class="clsTaskCardBackFieldButton">
                  <span class="material-icons" onclick="clkFlipTaskCardToTask(this)" title="Return">keyboard_double_arrow_right</span>
                </div>
              </div>

            </div> <!-- clsTaskCardBackContainer -->
          </div> <!-- back face clsTaskCardBack -->
              </div>
          </div>

            `;
    // Ensure tags are rendered as pills on initial render
    try { updateTaskField(y, 'task_tag', x.task_tag); } catch (err) { /* ignore if DOM not ready */ }

  });

  // After rendering all tasks, update section previews if needed
  try { updateAllSectionPreviews(); } catch (err) { /* ignore */ }


}

// Helper function to parse, lowercase, and deduplicate tags
function parseAndDeduplicateTags(tagString) {
  if (!tagString || tagString.trim() === '') return [];
  return [...new Set(tagString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag))];
}

// Function to update single fields from card back
function updateTaskField(index, field, value) {
  if (field.startsWith('date_') && value) {
    // Store as ISO string
    data[index][field] = new Date(value).toISOString();
  } else {
    data[index][field] = value;
  }
  localStorage.setItem("data", JSON.stringify(data));

  // Update the display text while preserving the label
  const displayEl = document.getElementById(`display_${field}_${index}`);
  if (displayEl) {
    // Get or create the label span
    let labelEl = displayEl.querySelector('.clsFieldLabel');

    // Clear the display element but preserve or recreate the label
    displayEl.innerHTML = '';
    if (labelEl) {
      displayEl.appendChild(labelEl);
    } else {
      // Recreate label if it doesn't exist
      const newLabel = document.createElement('span');
      newLabel.className = 'clsFieldLabel';
      // Derive label from field name
      const labelMap = {
        'date_due': 'Due',
        'status': 'Status',
        'date_closed': 'Closed',
        'task_tag': 'Tags'
      };
      newLabel.textContent = labelMap[field] || field;
      displayEl.appendChild(newLabel);
    }

    // Render content based on field type
    if (field === 'task_tag') {
      // Parse, deduplicate, and render tags as pills
      const tags = parseAndDeduplicateTags(value);
      if (tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'clsTagsContainer';
        tags.forEach(tag => {
          const tagPill = document.createElement('span');
          tagPill.className = 'clsTag';
          tagPill.textContent = tag;
          tagPill.onclick = (e) => {
            e.stopPropagation();
            toggleTaskFieldEdit(null, index, 'task_tag'); // Exit pill view
            toggleTaskFieldEdit({ type: 'click' }, index, 'task_tag'); // Enter edit mode
          };
          tagsContainer.appendChild(tagPill);
        });
        displayEl.appendChild(tagsContainer);
      } else {
        const noneText = document.createTextNode(' None');
        displayEl.appendChild(noneText);
      }
    } else {
      // Render text/date content as before
      let displayText = '';
      if (field.startsWith('date_') && value) {
        displayText = new Date(value).toISOString().split('T')[0];
      } else if (value) {
        displayText = value;
      } else {
        displayText = 'None';
      }
      displayEl.appendChild(document.createTextNode(' ' + displayText));
    }
  }
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
      previewEl.textContent = `${firstTitle} (${count})`;
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

// function clkCardEditTitleOrDetail(e) {

//   var editTitle = e.parentElement.previousElementSibling.previousElementSibling;
//   var editDetail = e.parentElement.previousElementSibling;
//   //  alert(editTitle +" "+ editDetail);

//   editTitle.setAttribute("contenteditable", "true");
//   editDetail.setAttribute("contenteditable", "true");

//   editTitle.setAttribute("class", "clsTaskCardTitleEdit");
//   editDetail.setAttribute("class", "clsTaskCardDetailEdit");

//   //document.body.setAttribute('contenteditable', 'true');
//   document.onkeydown = function (event) {

//     if (event.ctrlKey && event.key === 'Enter' || event.key === 'Escape')  // CTRL+Enter pressed or Esc pressed

//     {
//       //document.body.setAttribute('contenteditable', 'false');
//       editTitle.setAttribute("contenteditable", "false");
//       editDetail.setAttribute("contenteditable", "false");

//       editTitle.setAttribute("class", "clsTaskCardTitle");
//       editDetail.setAttribute("class", "clsTaskCardDetail");

//       var cardID = editTitle.parentElement.parentElement.parentElement.id; //get the index id from the parent div

//       data[cardID].Task_Title = editTitle.innerHTML;
//       data[cardID].task_detail = editDetail.innerHTML;

//       // data.push({
//       //     //title: data["Task_Title"]=editTitle.innerHTML,
//       //     //task_detail:data["task_detail"]=editDetail.innerHTML,
//       //     title: data[cardID].Task_Title=editTitle.innerHTML,
//       //     task_detail:data[cardID].task_detail=editDetail.innerHTML,

//       //     date_due: "17/07/2022",
//       //     date_captured: "16/07/2022", 
//       //     task_tag:"career",
//       //   });

//       localStorage.setItem("data", JSON.stringify(data));

//       console.log("TASKFLOW: ", data);


//       // editTitle.parentElement.parentElement.remove() //eventually want to replace the ID instead of adding/deleting

//       //createPost(); //eventually want to replace the ID instead of adding/deleting

//     }
//   }
// }

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

    data[cardID].Task_Title = editTitle.innerHTML.trim();
    data[cardID].task_detail = editDetail.innerHTML.trim();

    localStorage.setItem("data", JSON.stringify(data));
    console.log("TASKFLOW: Saved task", cardID);

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


function clkToggleBackgroundAnimation() {

  ////
  // Toggle JS and CSS background
  ////

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

function clkExportTasksToJSON() {
  console.log("Exporting tasks from localStorage to JSON");
  showToast("Exporting tasks from localStorage to JSON file", "info");

  var exportData = JSON.parse(localStorage.getItem("data")) || [];
  var exportSettings = JSON.parse(localStorage.getItem("settings")) || {};

  if (exportData.length === 0) {
    showToast("No tasks to export", "error");
    return;
  }

  // Create full state object
  var fullState = {
    meta: {
      version: "2.0",
      exported_at: new Date().toISOString()
    },
    settings: exportSettings,
    tasks: exportData
  };

  var jsonContent = JSON.stringify(fullState, null, 2);

  var hiddenElement = document.createElement('a');
  hiddenElement.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonContent);
  hiddenElement.target = '_blank';

  hiddenElement.download = Date.now() + '_Taskflow.json';
  hiddenElement.click();
  showToast("Tasks exported to JSON successfully!", "success");
}






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
//
// Upload CSV into local storage
//
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

        // Handle New Format (Object with tasks/settings)
        if (json.tasks && Array.isArray(json.tasks)) {
          localStorage.setItem("data", JSON.stringify(json.tasks));

          if (json.settings) {
            localStorage.setItem("settings", JSON.stringify(json.settings));
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
    // Regex to split by comma but ignore commas inside quotes
    // const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    // Fallback if regex fails or simple split needed? No, regex is better for quoted CSV.
    // Actually, simple regex might miss empty fields. Let's use a robust parser loop.

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

      // Handle arrays (semicolon separated)
      // Check if it looks like an array we exported? 
      // We can't know for sure without schema, but for 'subtasks' or tags we might guess.
      // For now, keep as string unless it clearly contains semicolons? 
      // User only asked to use semicolons as separators.

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





// // convert CSV to JSON REPLACED 2025-07-08
// function clkExportTasksToLocalFile() {
//   console.log("CLICKED stub for saving tasks");

//   // Use first element to choose the keys and the order
//   var keys = Object.keys(data[0]);

//   // Build header
//   var csvContent = keys.map(escapeCsvValue).join(",") + "\n";

//   // Add the rows
//   data.forEach(function (obj) {
//     csvContent += keys.map(key => escapeCsvValue(obj[key])).join(",") + "\n";
//   });

//   console.log(csvContent);

//   //Download the <timestamp>Taskflow.csv file
//   var hiddenElement = document.createElement('a');
//   hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
//   hiddenElement.target = '_blank';

//   //provide the name for the CSV file to be downloaded
//   hiddenElement.download = Date.now() + 'Taskflow.csv';
//   hiddenElement.click();

//   // Helper function to escape values for CSV
//   function escapeCsvValue(value) {
//     if (value === null || value === undefined) {
//       return '';
//     }
//     let stringValue = String(value);
//     // Check if the value contains a comma, double quote, or newline
//     if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
//       // Escape double quotes by replacing them with two double quotes
//       stringValue = stringValue.replace(/"/g, '""');
//       // Enclose the value in double quotes
//       return `"${stringValue}"`;
//     } else {
//       return stringValue;
//     }
//   }
// }





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


function selectTaskForDashboard(card) {
  // Only active in dashboard view
  if (!document.body.classList.contains('view-dashboard')) return;

  const detailPane = document.getElementById('idDetailPane');
  if (!detailPane) return;

  // Clear previous content
  detailPane.innerHTML = '';

  const title = card.querySelector('.clsTaskCardTitle').textContent;

  // Safe text content retrieval
  const detailEl = card.querySelector('.clsTaskCardDetail');
  const detail = detailEl ? detailEl.textContent : '';

  const dateEl = card.querySelector('.clsTaskInfo');
  const date = dateEl ? dateEl.textContent : '';

  const tagEl = card.querySelector('.clsTaskTag');
  const tag = tagEl ? tagEl.textContent : '';

  const sectionHeader = card.closest('.clsDropArea').querySelector('.sectionHeader');
  const status = sectionHeader ? sectionHeader.textContent.trim() : 'Unknown';

  // Highlight active card
  document.querySelectorAll('.clsTaskCardWrapper.active').forEach(el => el.classList.remove('active'));
  card.closest('.clsTaskCardWrapper').classList.add('active');

  // Build Detail Pane Content
  const html = `
    <h3>${title}</h3>
    <div style="margin-bottom: 20px;">
        <span class="clsTaskTag" style="font-size: 1.1em">${tag}</span>
        <span style="float: right; color: var(--color-text-secondary)">${date}</span>
    </div>
    <div style="background: var(--color-bg-container); padding: 15px; border-radius: var(--radius-md); min-height: 200px;">
        <p style="white-space: pre-wrap;">${detail || 'No details provided.'}</p>
    </div>
    <br>
    <p><strong>Status:</strong> ${status}</p>
    <div style="margin-top: 20px; text-align: right;">
         <button class="btnEditDetails" style="cursor:pointer; padding: 8px 16px; border: none; background: var(--color-primary); color: white; border-radius: 4px;">Edit Task</button>
    </div>
  `;

  detailPane.innerHTML = html;

  // Attach edit handler
  const editIcon = card.querySelector('.clsTaskCardHoverIcons i[title="Edit details"]');
  if (editIcon) {
    const btn = detailPane.querySelector('.btnEditDetails');
    if (btn) btn.onclick = function () {
      editIcon.click();
    };
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
// DOCUMENTATION
//-------------------------------------------------------------------------

// Fieldnames
//        - Task_Title = captures the OUTCOME you want to achieve from completing a task
//        - task_detail = captures the NEXT realistic step in the task
//        - date_due = when you need to DELETE it by
//        - date_captured = auto populated at date of task creation, used for analytics
//        - task_tag = this is the PROJECT label, used to filter all tasks by project


// Source credits
// [audio loops] https://joeweaver.me/codepenassets/freecodecamp/challenges/build-a-pomodoro-clock/


// Variables and Constants

// JS Functions


// CSS


//-------------------------------------------------------------------------
// TITLE TILT AND GLINT ANIMATION
//-------------------------------------------------------------------------

/**
 * Add click event listeners to title elements for tilt and glint animation
 */
function addTitleAnimation() {
  const titleElements = [
    document.getElementById('idTaskflowAppTitle'),
    document.getElementById('idTaskflowTodaySubTitle')
  ];

  titleElements.forEach(element => {
    if (!element) return;

    element.addEventListener('click', function () {
      // Add animation class
      this.classList.add('tilt-glint-active');

      // Remove class after animation completes
      const handleAnimationEnd = () => {
        this.classList.remove('tilt-glint-active');
        this.removeEventListener('animationend', handleAnimationEnd);
      };

      this.addEventListener('animationend', handleAnimationEnd);
    });
  });
}

// Initialize title animation when page loads
addTitleAnimation();
