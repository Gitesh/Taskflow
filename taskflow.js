
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
    if (input.value === "+add") {
        msg.innerHTML = "no text entered...";

        console.log("ERROR: no text was entered");

    }
    else {
        console.log("OK: text was entered");

        msg.innerHTML = "";

        acceptData(); // call the acceptData function

        input.blur(input.value= "+add"); //clear the input textbox
    }
}


//------
//store input field into a new object called data
//------

//create empty data object
let data = {};

//create a function called accept data to store the input in the object named data
let acceptData = () => {
    data["title"] = input.value;

    console.log("TASKFLOW: ",data)

    data["task_detail"]="this is the task";
    data["date_due"]="17/07/2022";
    data["date_captured"]="16/07/2022"; 
    data["tag_project"]="career";

    console.log("TASKFLOW: ",data)


    createPost();
};

//------
//publish the data as a new task
//------

//create a div element and append it to the 'posts' div on the right
//we need 1. Parent div, 2. the input, 3. clsTaskCard div with the icons
// editPost(this) where this is the element that fired the event, eg edit icon

function createPost() {

    dropbox4.innerHTML += `
    <div id="${data.title}" draggable="true" ondragstart="drag(event)">       
        <span class="clsTaskCard">
            <b>${data.title}</b>&nbsp - &nbsp
            ${data.task_detail}
            <i onclick="clkCardEditPost(this)" class="fas fa-edit"> </i> 
            <i onclick="clkCardDeletePost(this)" class="fas fa-trash-alt"> </i>
        </span>
    <div> <!--END DIV NOTE-->     

    `; //backticks are template literals, so this will act as a template.
}







//------
//delete a post function
//------

//see createPost function, where parent of the delete button is the span with the classnane 'clsTaskCard' which shows the icons.

// let deletePost = (e) => {
//     e.parentElement.parentElement.remove();
// };  

function clkCardDeletePost(e){
    e.parentElement.parentElement.remove();
};  


//------
//edit a post function
//------

function clkCardEditPost(e){
    input.value = e.previousElementSibling.innerHTML;
    // input.value = e.ElementSibling.innerHTML;
    // input.value = "this is the edit text";
    e.parentElement.parentElement.remove();
};  


//------
// add a new card
//------

// function clkBoxAdd(strCardTitle, strCardText){

//     var strTextEntered = value + " " + box;
//     window.alert(strTextEntered);

//     // createPost(strTextEntered);

//     createPost(strCardTitle, strCardText);
// };



// var inputBox = document.getElementById("inputBox2");
// inputBox.addEventListener("keypress", function(event) {
//   if (event.key === "Enter") {
//     event.preventDefault();
//     document.getElementById("myBtn").click();
//     inputBox2.value="+add";
//     event.target.blur();

//   }
// });

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