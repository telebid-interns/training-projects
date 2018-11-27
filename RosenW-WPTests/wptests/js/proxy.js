// for ( i=0; i<document.styleSheets.length; i++) {
//     document.styleSheets.item(i).disabled=true;
// }

// let myNode = document.getElementById("foo");
// while (myNode.firstChild) {
//     myNode.removeChild(myNode.firstChild);
// }

document.getElementsByTagName('head')[0].innerHTML = '';
document.getElementById('test-container').removeChild(document.getElementsByTagName('base')[0]);