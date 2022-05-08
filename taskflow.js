
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







var canvas = document.createElement("canvas");
var width = canvas.width = window.innerWidth * 0.75;
var height = canvas.height = window.innerHeight * 0.75;
// document.body.appendChild(canvas);
document.getElementById("container").appendChild(canvas);
var gl = canvas.getContext('webgl');

var mouse = {x: 0, y: 0};

var numMetaballs = 30;
var metaballs = [];

for (var i = 0; i < numMetaballs; i++) {
  var radius = Math.random() * 60 + 10;
  metaballs.push({
    x: Math.random() * (width - 2 * radius) + radius,
    y: Math.random() * (height - 2 * radius) + radius,
    vx: (Math.random() - 0.5) * 3,
    vy: (Math.random() - 0.5) * 3,
    r: radius * 0.75
  });
}

var vertexShaderSrc = `
attribute vec2 position;

void main() {
// position specifies only x and y.
// We set z to be 0.0, and w to be 1.0
gl_Position = vec4(position, 0.0, 1.0);
}
`;

var fragmentShaderSrc = `
precision highp float;

const float WIDTH = ` + (width >> 0) + `.0;
const float HEIGHT = ` + (height >> 0) + `.0;

uniform vec3 metaballs[` + numMetaballs + `];

void main(){
float x = gl_FragCoord.x;
float y = gl_FragCoord.y;

float sum = 0.0;
for (int i = 0; i < ` + numMetaballs + `; i++) {
vec3 metaball = metaballs[i];
float dx = metaball.x - x;
float dy = metaball.y - y;
float radius = metaball.z;

sum += (radius * radius) / (dx * dx + dy * dy);
}

if (sum >= 0.99) {
gl_FragColor = vec4(mix(vec3(x / WIDTH, y / HEIGHT, 1.0), vec3(0, 0, 0), max(0.0, 1.0 - (sum - 0.99) * 100.0)), 1.0);
return;
}

gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}

`;

var vertexShader = compileShader(vertexShaderSrc, gl.VERTEX_SHADER);
var fragmentShader = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER);

var program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

var vertexData = new Float32Array([
  -1.0,  1.0, // top left
  -1.0, -1.0, // bottom left
  1.0,  1.0, // top right
  1.0, -1.0, // bottom right
]);
var vertexDataBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

var positionHandle = getAttribLocation(program, 'position');
gl.enableVertexAttribArray(positionHandle);
gl.vertexAttribPointer(positionHandle,
                       2, // position is a vec2
                       gl.FLOAT, // each component is a float
                       gl.FALSE, // don't normalize values
                       2 * 4, // two 4 byte float components per vertex
                       0 // offset into each span of vertex data
                      );

var metaballsHandle = getUniformLocation(program, 'metaballs');

loop();
function loop() {
  for (var i = 0; i < numMetaballs; i++) {
    var metaball = metaballs[i];
    metaball.x += metaball.vx;
    metaball.y += metaball.vy;

    if (metaball.x < metaball.r || metaball.x > width - metaball.r) metaball.vx *= -1;
    if (metaball.y < metaball.r || metaball.y > height - metaball.r) metaball.vy *= -1;
  }

  var dataToSendToGPU = new Float32Array(3 * numMetaballs);
  for (var i = 0; i < numMetaballs; i++) {
    var baseIndex = 3 * i;
    var mb = metaballs[i];
    dataToSendToGPU[baseIndex + 0] = mb.x;
    dataToSendToGPU[baseIndex + 1] = mb.y;
    dataToSendToGPU[baseIndex + 2] = mb.r;
  }
  gl.uniform3fv(metaballsHandle, dataToSendToGPU);
  
  //Draw
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(loop);
}

function compileShader(shaderSource, shaderType) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
  }

  return shader;
}

function getUniformLocation(program, name) {
  var uniformLocation = gl.getUniformLocation(program, name);
  if (uniformLocation === -1) {
    throw 'Can not find uniform ' + name + '.';
  }
  return uniformLocation;
}

function getAttribLocation(program, name) {
  var attributeLocation = gl.getAttribLocation(program, name);
  if (attributeLocation === -1) {
    throw 'Can not find attribute ' + name + '.';
  }
  return attributeLocation;
}

canvas.onmousemove = function(e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
}