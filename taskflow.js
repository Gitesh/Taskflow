
//load elements into variables
let form = document.getElementById("form");
let input = document.getElementById("input");
let msg = document.getElementById("idErrorMessage");

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

  // Check if user is editing text
  const isEditing = document.activeElement.isContentEditable ||
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'TEXTAREA';

  if (event.key === '?' && !isEditing) clkSettings();

  console.log(`${event.type} has been fired`);
  console.log(`${event.key} key was pressed`);

});
// --END-- Shortcut keys

////
//Show Settings Panel
////

function clkSettings() {
  var myDialog = document.createElement("dialog");
  document.body.appendChild(myDialog)
  myDialog.setAttribute("id", "dialog");
  myDialog.setAttribute("onclick", "this.close(); this.remove()");
  myDialog.setAttribute("onkeydown", "if (event.key === 'Escape' || event.key === '?') this.close(); this.remove();");

  myDialog.append("[CTRL + SHIFT + A] Add a new task");
  myDialog.appendChild(document.createElement("p"));


  myDialog.append("[CTRL + SHIFT + F] Flip to timer");
  myDialog.appendChild(document.createElement("p"));

  myDialog.append("[CTRL + SHIFT + B] Toggle background animation");
  myDialog.appendChild(document.createElement("p"));

  myDialog.append("[CTRL + SHIFT + P] Filter Pending Tasks");
  myDialog.appendChild(document.createElement("p"));

  myDialog.append("[CTRL + SHIFT + U] Upload saved file");
  myDialog.appendChild(document.createElement("p"));

  myDialog.append("Double click section headers to rename them.");
  myDialog.appendChild(document.createElement("p"));

  myDialog.appendChild(document.createElement("p"));
  myDialog.appendChild(document.createElement("hr"));
  myDialog.appendChild(document.createElement("p"));
  myDialog.append("Press any key to close");

  myDialog.style.cssText = "padding: 20px; font-family: sans-serif; background: black; color: cyan; opacity: 0.7; text-align:left";

  myDialog.showModal();
};

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
  if (input.value === "+add" || input.value.trim() === "") {
    // msg.innerHTML = "no text entered...";  //display error error message in div
    showToast("Type a title/outcome, or ESC to cancel", "error");

    console.log("ERROR: no text was entered");

  }
  else {
    console.log("OK: text was entered");

    msg.innerHTML = ""; //clear error message dic

    acceptData(); // call the acceptData function

    input.blur(input.value = "+add"); //clear the input textbox

  }
}

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
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <span class="material-icons" style="font-size: 18px; cursor: pointer;" onclick="this.parentElement.remove()">close</span>
  `;

  // Add to container
  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');

    // Remove from DOM after animation
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
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
    status: "Open", // Open, Closed, Pending
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
    <div id="${y}" class="clsTaskCardWrapper" draggable="true" ondragstart="drag(event)">
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

            <label for="inpDateDue">Due</label>
            <input name="inpDateDue" type="date" value="${x.date_due ? x.date_due.split('T')[0] : ''}" onchange="updateTaskField(${y}, 'date_due', this.value)">

             <label for="inpTaskTag">Tag</label>
              <input name="inpTaskTag" type="text" value="${x.task_tag}" onchange="updateTaskField(${y}, 'task_tag', this.value)">

             <br>
             <label for="inpStatus">Status</label>
             <select name="inpStatus" onchange="updateTaskField(${y}, 'status', this.value)">
                <option value="Open" ${x.status === 'Open' ? 'selected' : ''}>Open</option>
                <option value="Pending" ${x.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Closed" ${x.status === 'Closed' ? 'selected' : ''}>Closed</option>
             </select>

             <label for="inpDateClosed">Closed</label>
             <input name="inpDateClosed" type="date" value="${x.date_closed ? x.date_closed.split('T')[0] : ''}" onchange="updateTaskField(${y}, 'date_closed', this.value)">

                <span class="material-icons" onclick="clkFlipTaskCardToTask(this)" title="Return">keyboard_double_arrow_right</span>

                <BR>
                  Created (${x.date_captured ? x.date_captured.split('T')[0] : ''})

                </div> <!-- back face clsTaskCardBack -->
              </div>
          </div>

          `;


  });


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
}



function clkFlipTaskCardToForm(e) {
  //var cardID = e.parentElement.parentElement.parentElement.parentElement.id; //get the index id from the parent div
  //console.log("TASKFLOW: ", cardID);
  //  console.log(e.parentElement.parentElement.parentElement.classList);// this is the clsTasKCardAll span

  var setClassToFlipped = e.parentElement.parentElement.parentElement

  setClassToFlipped.classList.toggle("is-flipped");
}


function clkFlipTaskCardToTask(e) {

  var setClassToUnFlipped = e.parentElement.parentElement

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

  console.log("TASKFLOW: clkFlipToCountDownTimer");

  document.getElementById("idContainerAll").classList.toggle("is-flipped");


}




//immediately invoked function expression to reload tasks

//immediately invoked function expression to reload tasks
(() => {
  // Load data
  data = JSON.parse(localStorage.getItem("data")) || [];
  // Migration for old data
  data.forEach(task => {
    if (!task.section) task.section = "div4";
    if (!task.status) task.status = "Open";
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
})();


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

function allowDrop(e) {
  e.preventDefault();
}

function drag(e) {
  e.dataTransfer.setData("Text", e.target.id);
}

function drop(e) {
  e.preventDefault();
  var taskIndex = e.dataTransfer.getData("Text");

  // Find which drop area (section) was target
  var dropZone = e.target.closest('.clsDropArea');

  if (dropZone) {
    var sectionId = dropZone.id;
    // Update data model
    if (data[taskIndex]) {
      data[taskIndex].section = sectionId;
      localStorage.setItem("data", JSON.stringify(data));

      // Move visually to the correct dropbox
      // We find the dropbox within the section
      var dropboxId = sectionId.replace("div", "dropbox");
      var dropbox = document.getElementById(dropboxId);
      if (dropbox) {
        dropbox.appendChild(document.getElementById(taskIndex));
      }
    }
  }
}

//-------------------
// edit front of card
//-------------------

function clkCardEditTitleOrDetail(e) {

  var editTitle = e.parentElement.previousElementSibling.previousElementSibling;
  var editDetail = e.parentElement.previousElementSibling;
  //  alert(editTitle +" "+ editDetail);

  editTitle.setAttribute("contenteditable", "true");
  editDetail.setAttribute("contenteditable", "true");

  editTitle.setAttribute("class", "clsTaskCardTitleEdit");
  editDetail.setAttribute("class", "clsTaskCardDetailEdit");

  //document.body.setAttribute('contenteditable', 'true');
  document.onkeydown = function (event) {

    if (event.ctrlKey && event.key === 'Enter' || event.key === 'Escape')  // CTRL+Enter pressed or Esc pressed

    {
      //document.body.setAttribute('contenteditable', 'false');
      editTitle.setAttribute("contenteditable", "false");
      editDetail.setAttribute("contenteditable", "false");

      editTitle.setAttribute("class", "clsTaskCardTitle");
      editDetail.setAttribute("class", "clsTaskCardDetail");

      var cardID = editTitle.parentElement.parentElement.parentElement.id; //get the index id from the parent div

      data[cardID].Task_Title = editTitle.innerHTML;
      data[cardID].task_detail = editDetail.innerHTML;

      // data.push({
      //     //title: data["Task_Title"]=editTitle.innerHTML,
      //     //task_detail:data["task_detail"]=editDetail.innerHTML,
      //     title: data[cardID].Task_Title=editTitle.innerHTML,
      //     task_detail:data[cardID].task_detail=editDetail.innerHTML,

      //     date_due: "17/07/2022",
      //     date_captured: "16/07/2022", 
      //     task_tag:"career",
      //   });

      localStorage.setItem("data", JSON.stringify(data));

      console.log("TASKFLOW: ", data);


      // editTitle.parentElement.parentElement.remove() //eventually want to replace the ID instead of adding/deleting

      //createPost(); //eventually want to replace the ID instead of adding/deleting

    }
  }
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

  }

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
  alert("stub for pending tasks");
};




////////
//
// Upload CSV into local storage
//
////////

//OLD upload code 2025-07-08

// function clkUploadTasksToLocalStorage(){
//   console.log("CLICKED - stub for file upload")

//   var fileInput = document.getElementById("uploadCSV"),

//   readFile = function () {
//       var reader = new FileReader();
//       reader.onload = function () {


// //        convertCSVtoJSON(reader.result);

//       convertCSVtoJSON (reader.result);




//         // document.getElementById('uploadCSVOutput').innerHTML = reader.result;
//       };
//       // start reading the file. When it is done, calls the onload event defined above.
//       reader.readAsBinaryString(fileInput.files[0]);

//   };

// fileInput.addEventListener('change', readFile);

// }

//Convert CSV to OBJECT -- original replaced 2025-07-08
// function convertCSVtoJSON(uploadedCSV) {

//   //lop off any trailing or starting whitespace
//   csv = uploadedCSV.trim();

//   //check for special characters
//   let string = ''
//   let quoteFlag = 0
//   for (let character of csv) {
//     //console.log("TASKFLOW character: ", character);
//     if (character === '"' && quoteFlag === 0) {
//         quoteFlag = 1
//     }
//     else if (character === '"' && quoteFlag == 1) quoteFlag = 0
//     if (character === ',' && quoteFlag === 0) character = '|'
//     if (character !== '"') string += character
//   }


//   //prep
//   let lines = csv.split('\n'),
//       headers,
//       output = [];

//   //console.log("TASKFLOW headers: ", headers);
//   //console.log("TASKFLOW lines: ", lines);

//   //iterate over lines...
//   lines.forEach((line, i) => {

//       //...break line into tab-separated parts
//       // let parts = line.split(/\t+/);
//       let parts = line.split(',');

//       //...if not the headers line, push to output. By this time
//      //we have the headers logged, so just match the value to
//      //header of the same index
//       if (i) {
//           let obj = {};
//           parts.forEach((part, i) => obj[headers[i]] = part);
//           output.push(obj);

//       //...else if headers line, log headers
//       } else
//           headers = parts;
//   })

//   //done
//   //console.log("TASKFLOW convert CSV to Object: ",output);

//   // Store the uploaded data into local storage replacing data object
//   localStorage.setItem("data",JSON.stringify(output));
//   console.log("TASKFLOW convert data: ",data);
//   document. location. reload()

//   return output;


// }


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
//
// TO DO - ironic because soon I'll be able to us the app when it's stable
//
//-------------------------------------------------------------------------

// ----REFACTOR CODE----
// [ ] Refactor Vars with Let{} blocks https://www.freecodecamp.org/news/var-let-and-const-whats-the-difference/
//        - var variables can be updated and re-declared within its scope;
//        - let variables can be updated but not re-declared;
//        - const variables can neither be updated nor re-declared.


// [ ] Workflow - should activate enter task detail after entering new task heading

// ----DATA SCHEMA----
// [/] Rename title to Task_Title
// [ ] Also use capitals for all headings


// ----CSV DOWNLOAD/UPLOAD----
// [ ] bug in csv export / import - commas within a field are treated as delimiters
// [ ] Fix bug when spreadsheet is uploaded with " it adds quotes to the whole field.
// https://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript-which-contains-comma-in-data


// ----LOCAL STORAGE TIPS----
// Store variables using the Web Storage API, there are only 4 operations
//
//https://code-boxx.com/connect-database-javascript/
//
// 1. CREATE a data object:
//          var user = {
//            name : "John Doe",
//            email : "john@doe.com",
//            gender : "Doe"
//            };
//
// 2. STORE Saves data into the local storage. Note JSON ENcode:
//            localStorage.setItem(KEY, VALUE)
//    example:
//            localStorage.setItem("User", JSON.stringify(user));
//
// 3. RETRIEVE from local storage. Note JSON DEcode:
//
//          user = localStorage.getItem("User");
//          user = JSON.parse(user);
//          console.log(user);
//
//    Example:
//           localStorage.getItem(KEY)
//
// 4. DELETE remove data from the local storage
//
//            localStorage.removeItem(KEY)
//
//    Destroy data object
//            localStorage.clear()





// ----TASK FRONT----
// [ ] show total number of tasks
// [ ] separate deleted tasks and tasks marked 'completed'.
// [ ] Toggle edit icon when in edit task mode
// [ ] Show age of tasks on card - to help reprioritise each day.


// ----TASK BACK FORM----
// [ ] output all fields on task back
// [ ] Field - Add last edited date
// [/] css card flip elements on back face clicks still active. FIXED add z plane to back


// ----TIMELINE------
// [ ] toggle completed tasks from the timeline to reopen (and remove from the timeline)
// [ ] include only completed tasks in the historical timline view

// ----POMODORO----
// [/] Activate sound icons to show which are playing
