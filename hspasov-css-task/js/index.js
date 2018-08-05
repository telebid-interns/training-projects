const contaner = document.getElementById('container');
document.getElementById('add-content-btn').addEventListener('click', (e) => container.innerHTML += '<div class="container-item"><img class="container-image" src="./images/mountain.jpeg"></div>');
document.getElementById('remove-content-btn').addEventListener('click', (e) => container.firstChild && container.removeChild(container.firstChild));
