
//load elements into variables

let form = document.getElementById("form");
let input = document.getElementById("input");
let msg = document.getElementById("msg");
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
    if (input.value === "") {
        msg.innerHTML = "You didn't enter any text...";

        console.log("ERROR: no text was entered");

    }
    else {
        console.log("OK: text was entered");

        msg.innerHTML = "";

        acceptData(); // call the acceptData function

        input.value = ""; //clear the input textbox
    }
}

// REPLACED BY FUNCTION
// let formValidation = () => {
//     if (input.value ==="") {
//         msg.innerHTML = "You didn't enter any text..."

//         console.log("ERROR: no text was entered")

//     }
//     else {
//         console.log("OK: text was entered")

//         msg.innerHTML = "";
//     }
// };


//------
//store input field into a new object called data
//------


//create empty data object
let data = {};

//create a function called accept data to store the input in the object named data
let acceptData = () => {
    data["text"] = input.value;

    console.log("TASKFLOW: ",data)

    createPost();
};

//------
//publish the data as a new task
//------

//create a div element and append it to the 'posts' div on the right
//we need 1. Parent div, 2. the input, 3. clsTaskCard div with the icons
// editPost(this) where this is the element that fired the event, eg edit icon

let createPost = () => {
    posts.innerHTML += `
    <div id="${data.text}" draggable="true" ondragstart="drag(event)">
        
        <span class="clsTaskCard">
            <p>${data.text}</p>
            <i onclick="clkCardEditPost(this)" class="fas fa-edit"> </i> 
            <i onclick="clkCardDeletePost(this)" class="fas fa-trash-alt"> </i>
        </span>
    <div> <!--END DIV NOTE-->     

    `;  //backticks are template literals, so this will act as a template.
};







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
    e.parentElement.parentElement.remove();
};  


//------
// add a new card
//------

function clkBoxAdd(box){
     window.alert(box);
};