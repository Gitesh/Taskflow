//load elements into variables

let form = document.getElementById("form");
let input = document.getElementById("input");
let msg = document.getElementById("idErrorMessage");
let posts = document.getElementById("posts");

console.log("TASKFLOW:js loaded")

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

//create empty data object
// let data = {};

let data =[];

//create a function called accept data to store the input in the object named data
let acceptData = () => {
    data["Task_Title"] = input.value;

    // console.log("TASKFLOW: ",data)

    // data["task_detail"]="this is the task";
    // data["date_due"]="17/07/2022";
    // data["date_captured"]="16/07/2022"; 
    // data["tag_project"]="career";

    // console.log("TASKFLOW: ",data)


    data.push({
      Task_Title: data["Task_Title"]=input.value,
      task_detail:data["task_detail"]="this is the task",
      date_due: "17/07/2022",
      date_captured: "16/07/2022", 
      task_tag:"career",
    })

    localStorage.setItem("data", JSON.stringify(data));


    console.log("TASKFLOW: ",data)
    
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
          
                 <span class="clsTaskCardTitle">${x.Task_Title}</span>&nbsp - &nbsp
                 <span class="clsTaskCardDetail">${x.task_detail}</span>
                 <span class="clsTaskCardHoverIcons">
                     
                    <i onclick="clkCardEditTitleOrDetail(this)" title="Edit task" class="material-icons">edit</i> 
                    <i onclick="clkFlipTaskCardToForm(this)" title="Edit task attributes" class="material-icons">edit_calendar</i>
                    <i onclick="clkCardDeleteTask(this)" title="Delete this task" class="material-icons">delete</i>
                 
                 </span>
          
          </div> <!-- front face clsTaskCard-->
          
          

          <div class="clsTaskCardBack">
            <label for="inpDateDue">Due</label>
            <input name="inpDateDue" type="date" value="">
            
            <label for="inpDateAdded">Added</label>
            <input name="inpDateAdded" type="date" value="">
            
            <span class="material-icons" onclick="clkFlipTaskCardToTask(this)">keyboard_double_arrow_right</span>
          

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
}



//immedinately invoked function expression to reload tasks

(() => {
  data = JSON.parse(localStorage.getItem("data")) || [];
  console.log("json loaded: ",data);
  createPost();
})();




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
//edit a post function
//------

// function clkCardEditPost(e){

//   //alert(e.parentElement.previousElementSibling.innerHTML); // this is the task detail
//   //alert(e.parentElement.previousElementSibling.previousElementSibling.innerHTML);// this is the title 

//   input.value = e.parentElement.previousElementSibling.previousElementSibling.innerHTML;// this is the title 
  
// clkCardDeleteTask(e);


// };  


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

  var keyCode="";
  var editTitle = e.parentElement.previousElementSibling.previousElementSibling;
  var editDetail = e.parentElement.previousElementSibling;

//  alert(editTitle +" "+ editDetail);
  
  editTitle.setAttribute("contenteditable", "true");
  editDetail.setAttribute("contenteditable", "true");

  editTitle.setAttribute("class", "clsTaskCardTitleEdit");
  editDetail.setAttribute("class", "clsTaskCardDetailEdit");

//    editTitle.className = "clsTaskCardTitleEdit"

  //document.body.setAttribute('contenteditable', 'true');
  document.onkeydown = function (e) {
    e = e || window.event;
    if(e.keyCode==27)  

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



function clkCountDownTimer(){
  console.log("CLICKED stub for countdown timer");

  window.open("https://codepen.io/JoeCodesStuff/full/bLbbxK");
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



function clkFilterPendingTasks(){
  alert("stub for pending tasks");
};


function clkSettings(){
  alert("stub for settings");
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
        
        var uploadedData = convertCSVtoJSON(reader.result);
        
        //console.log(uploadedData);  

        // document.getElementById('uploadCSVOutput').innerHTML = reader.result;
      };
      // start reading the file. When it is done, calls the onload event defined above.
      reader.readAsBinaryString(fileInput.files[0]);


  };

fileInput.addEventListener('change', readFile);


}


function convertCSVtoJSON(thisFile){

  csv = thisFile;

  console.log("TASKFLOW CSV: ",csv);
  
  // const fs = require("fs");
  // csv = fs.readFileSync("fileInput");
  
  const array = csv.toString().split("\n");
  
  /* Store the converted result into an array */
  const csvToJsonResult = [];
  
  /* Store the CSV column headers into seprate variable */
  const headers = array[0].split(", ")
  
  /* Iterate over the remaning data rows */
  for (let i = 1; i < array.length - 1; i++) {
  /* Empty object to store result in key value pair */
  const jsonObject = {}
  /* Store the current array element */
  const currentArrayString = array[i]
  let string = ''
  
  let quoteFlag = 0
  for (let character of currentArrayString) {
    if (character === '"' && quoteFlag === 0) {
        quoteFlag = 1
    }
    else if (character === '"' && quoteFlag == 1) quoteFlag = 0
    if (character === ', ' && quoteFlag === 0) character = '|'
    if (character !== '"') string += character
  }
  
  let jsonProperties = string.split("|")
  
  for (let j in headers) {
    if (jsonProperties[j].includes(", ")) {
    jsonObject[headers[j]] = jsonProperties[j]
      .split(", ").map(item => item.trim())
    }
    else jsonObject[headers[j]] = jsonProperties[j]
  }
  /* Push the genearted JSON object to resultant array */
  csvToJsonResult.push(jsonObject)
  }
  /* Convert the final array to JSON */
  const json = JSON.stringify(csvToJsonResult);

  console.log("TASKFLOW JSON ::::::::::", json)
    
}




// todo
// 1. Refactor Vars with Let{} blocks https://www.freecodecamp.org/news/var-let-and-const-whats-the-difference/
//    var variables can be updated and re-declared within its scope;
//    let variables can be updated but not re-declared;
//    const variables can neither be updated nor re-declared.
//
//
//
// 2. Iterate through tags
// [/] Rename title to Task_Title
// [ ] Also use capitals for all headings

// To add a new css file to a page just create a new <link> tag:

// function addCss (url) {
//     var s = document.createElement('link');
//     s.rel = 'stylesheet';
//     s.type = 'text/css';
//     s.href = url;
//     document.getElementsByTagName('head')[0].appendChild(s);
// }

// addCss('http://path/to/stylesheet.css');
// To remove a css file from a page just remove the <link> to it:

// function removeCss (search) {
//     var css = document.getElementsByTagName('link');
//     for (var i=0;i<css.length;i++) {
//         var c = css[i];
//         if (c.rel === 'stylesheet' || c.type === 'text/css') {
//             if (c.href && c.href.match(search)) {
//                 c.parentNode.removeChild(c);
//             }
//         }
//     }
// }

//
// var csvContent = 'title, task_detail, date_due, date_captured, task_tag\n';  

//
// save to local storage
//
//https://www.codegrepper.com/code-examples/javascript/save+to+local+storage+javascript

