
//load elements into variables
let form = document.getElementById("form");
let input = document.getElementById("input");
let msg = document.getElementById("idErrorMessage");

strDate = new Date();
strDate = strDate.toISOString();
strDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
strToday = new Date();

strToday = strDay[strToday.getDay()];
// alert(strToday);

console.log("TASKFLOW STARTED:js loaded", strDate)


document.getElementById("idTaskflowTodaySubTitle").innerHTML = strToday;

//add event listener to the form
form.addEventListener("submit", (e) => {
    e.preventDefault();
    console.log("TASKFLOW: submit button clicked");

    //create formValidation function 
    formValidation();
});

//create formValidation function - if text box is empty show error
function formValidation() {
    if (input.value == "+add") {
        msg.innerHTML = "no text entered...";

        console.log("ERROR: no text was entered");

    }
    else {
        console.log("OK: text was entered");

        msg.innerHTML = "";

        acceptData(); // call the acceptData function

        input.blur(input.value ="+add"); //clear the input textbox

    }
}


//------
//store input field into a new object called data
//------

//create empty data object to store tasks
let data =[];

//create a function called accept data to store the input in the object named data
let acceptData = () => {
    
    data.push({
      Task_Title: data["Task_Title"]=input.value,
      task_detail: data["task_detail"]="[Click edit to enter task detail]",
      date_due: "",
      date_captured: strDate, 
      task_tag:"career",
    })

    localStorage.setItem("data", JSON.stringify(data));

    console.log("TASKFLOW acceptData +add: ",data)
    
    createPost();

  };


//------
//publish the data as a new task
//------
let createPost = () => 
{
  dropbox4.innerHTML ="";

  data.map((x, y) =>
  {

    return (dropbox4.innerHTML += `
    <div id="${y}" class="clsTaskCardWrapper" draggable="true" ondragstart="drag(event)">       
        <div class="clsTaskCardAll" > <!-- 3d object  |||| clsTaskCardAll -->
          <div class="clsTaskCard">
          
<!-- TEST CODE: trying to activate tast edit on double click of the title, but issue with identifying parent or child elements -->

 <!--                <span class="clsTaskCardTitle" ondblclick="clkCardEditTitleOrDetail();alert('yes - doublclicked Task_Title');" >${x.Task_Title}</span>&nbsp - &nbsp -->
 <!--                <span class="clsTaskCardDetail" onclick="alert('no');">${x.task_detail}</span> -->

                 <span class="clsTaskCardTitle">${x.Task_Title}</span>&nbsp - &nbsp 
                 <span class="clsTaskCardDetail">${x.task_detail}</span>

                 <span class="clsTaskCardHoverIcons">                    
                    <i onclick="clkCardEditTitleOrDetail(this)" title="Edit details" class="material-icons">edit</i> 
                    <i onclick="clkFlipTaskCardToForm(this)" title="Edit attributes" class="material-icons">edit_calendar</i>
                    <i onclick="clkCardDeleteTask(this)" title="Delete this task" class="material-icons">delete</i>
                 </span>
          
          </div> <!-- front face clsTaskCard-->
          
          

          <div class="clsTaskCardBack">
          
            <label for="inpDateDue">Due</label>
              <input name="inpDateDue" type="date" value="${x.date_due}">
          
            <label for="inpTaskTag">Tag</label>
              <input name="inpTaskTag" type="text" value="${x.task_tag}">

            <span class="material-icons" onclick="clkFlipTaskCardToTask(this)" title="Return">keyboard_double_arrow_right</span>

            <BR>
              Created (${x.date_captured})         

          </div> <!-- back face clsTaskCardBack -->
        </div>
    </div>

    `);

    
  });


}



function clkFlipTaskCardToForm(e){
  //var cardID = e.parentElement.parentElement.parentElement.parentElement.id; //get the index id from the parent div
  //console.log("TASKFLOW: ", cardID);
  //  console.log(e.parentElement.parentElement.parentElement.classList);// this is the clsTasKCardAll span

  var setClassToFlipped = e.parentElement.parentElement.parentElement

  setClassToFlipped.classList.toggle("is-flipped");
}


function clkFlipTaskCardToTask(e){

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


function clkFlipToCountDownTimer(){

  console.log("TASKFLOW: clkFlipToCountDownTimer");
  
  document.getElementById("idContainerAll").classList.toggle("is-flipped");


}




//immediately invoked function expression to reload tasks

(() => {
  data = JSON.parse(localStorage.getItem("data")) || [];
  console.log("json loaded: ",data);
  createPost();
})();


////////
// Edit headings on double click. Sets content to editable for a short time
////////
function listenForDoubleClick(element) {
  element.contentEditable = true;
  setTimeout(function() {
    if (document.activeElement !== element) {
      element.contentEditable = false;
    }
  }, 300);
}

//------
//delete a post function
//------

//see createPost function, where parent of the delete button is the span with the classnane 'clsTaskCard' which shows the icons.

// let deletePost = (e) => {
//     e.parentElement.parentElement.remove();
// };  

function clkCardDeleteTask(e){
    //e.parentElement.parentElement.remove();

    e.parentElement.previousElementSibling.previousElementSibling.parentElement.parentElement.remove(); //this is the parent of the title, left in previous sibling to toubleshoot changes

    data.splice(e.parentElement.previousElementSibling.previousElementSibling.parentElement.parentElement.id,1);

    localStorage.setItem("data",JSON.stringify(data));
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
  var data = e.dataTransfer.getData("Text");
  e.target.appendChild(document.getElementById(data));
  e.preventDefault();
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
  
    if(event.ctrlKey && event.key === 'Enter' || event.key === 'Escape')  // CTRL+Enter pressed or Esc pressed

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
    
        console.log("TASKFLOW: ",data);


     // editTitle.parentElement.parentElement.remove() //eventually want to replace the ID instead of adding/deleting

      //createPost(); //eventually want to replace the ID instead of adding/deleting

    }
  }
}





function clkToggleBackgroundAnimation(){

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




function clkExportTasksToLocalFile(){
  console.log("CLICKED stub for saving tasks");

  // Use first element to choose the keys and the order
  var keys = Object.keys(data[0]);

  // Build header
  var result = keys.join(",") + "\n";

  // Add the rows
  data.forEach(function(obj){
      result += keys.map(k => obj[k]).join(",") + "\n";
  });

  console.log(result);

  //Download the <timestamp>Taskflow.csv file
  var hiddenElement = document.createElement('a');  
  hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(result);  
  hiddenElement.target = '_blank';  
    
  //provide the name for the CSV file to be downloaded  
  hiddenElement.download = Date.now()+'Taskflow.csv';  
  hiddenElement.click();  

};


////////
//
// STUB: Show Pending Tasks View
//
////////

function clkFilterPendingTasks(){
  alert("stub for pending tasks");
};

////////
//
// STUB: Show Settings Panel
//
////////


function clkSettings(){
  var myDialog = document.createElement("dialog");
  document.body.appendChild(myDialog)
    myDialog.setAttribute("id","dialog");
    myDialog.setAttribute("onclick","this.close(); this.remove()");
    myDialog.setAttribute("onkeydown","if (event.key === 'Escape' || event.key === '?') this.close(); this.remove();");

    myDialog.append("f : clkFlipToCountDownTimer()");
    myDialog.appendChild(document.createElement("p"));

    myDialog.append("b = clkToggleBackgroundAnimation()");
    myDialog.appendChild(document.createElement("p"));

    myDialog.append("p = clkFilterPendingTasks()");
    myDialog.appendChild(document.createElement("p"));

    myDialog.append("s = clkSettings()");
    myDialog.appendChild(document.createElement("p"));
    
    myDialog.appendChild(document.createElement("p"));
    myDialog.appendChild(document.createElement("hr"));
    myDialog.appendChild(document.createElement("p"));
    myDialog.append("ESC to close");
    
    myDialog.style.cssText = "padding: 20px; font-family: sans-serif; background: black; color: cyan; opacity: 0.7";
    
    myDialog.showModal();
};

function closeSettingsDialog() {
  document.getElementById('dialog').close();
  document.getElementById('dialog').remove();
  //alert("rwar");
  
};



////////
//
// Upload CSV into local storage
//
////////

function clkUploadTasksToLocalStorage(){
  console.log("CLICKED - stub for file upload")

  var fileInput = document.getElementById("uploadCSV"),

  readFile = function () {
      var reader = new FileReader();
      reader.onload = function () {
  
        
//        convertCSVtoJSON(reader.result);

      convertCSVtoJSON (reader.result);

        


        // document.getElementById('uploadCSVOutput').innerHTML = reader.result;
      };
      // start reading the file. When it is done, calls the onload event defined above.
      reader.readAsBinaryString(fileInput.files[0]);

  };

fileInput.addEventListener('change', readFile);

}

//Convert CSV to OBJECT 
function convertCSVtoJSON(uploadedCSV) {

  //lop off any trailing or starting whitespace
  csv = uploadedCSV.trim();
 
  //check for special characters
  let string = ''
  let quoteFlag = 0
  for (let character of csv) {
    //console.log("TASKFLOW character: ", character);
    if (character === '"' && quoteFlag === 0) {
        quoteFlag = 1
    }
    else if (character === '"' && quoteFlag == 1) quoteFlag = 0
    if (character === ',' && quoteFlag === 0) character = '|'
    if (character !== '"') string += character
  }


  //prep
  let lines = csv.split('\n'),
      headers,
      output = [];

  //console.log("TASKFLOW headers: ", headers);
  //console.log("TASKFLOW lines: ", lines);
  
  //iterate over lines...
  lines.forEach((line, i) => {

      //...break line into tab-separated parts
      // let parts = line.split(/\t+/);
      let parts = line.split(',');

      //...if not the headers line, push to output. By this time
     //we have the headers logged, so just match the value to
     //header of the same index
      if (i) {
          let obj = {};
          parts.forEach((part, i) => obj[headers[i]] = part);
          output.push(obj);

      //...else if headers line, log headers
      } else
          headers = parts;
  })

  //done
  //console.log("TASKFLOW convert CSV to Object: ",output);

  // Store the uploaded data into local storage replacing data object
  localStorage.setItem("data",JSON.stringify(output));
  console.log("TASKFLOW convert data: ",data);
  document. location. reload()

  return output;

  
}


////////
//  play the audio loop which is selected by passing the div
////////
function clkPlayAudio(sound){
 
 // console.log("TASKFLOW: playaudio",sound); 
 
 var audioElement= document.getElementById(sound);

 console.log("TASKFLOW audioelement: ",audioElement);
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