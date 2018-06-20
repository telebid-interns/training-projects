let CHANNEL_URL_ADDED_HANDLERS = [];
let CHANNEL_URL_REMOVED_HANDLERS = [];


function channelUrlIsDisplayed(url) {
    let lis = document.querySelectorAll('#url-list li');
    for(let k=0; k<lis.length; k++) {
        if (lis[k].textContent === url) {
            return true;
        }
    }
    return false;
}

function newChannelUrlListItem(url) {
    let li = document.createElement('li');
    let close_button = document.createElement('button');

    close_button.addEventListener("click", function (event) {
        hideChannelUrl(url);
    });

    li.textContent = url;
    li.appendChild(close_button);

    return li;
}


function displayChannelUrl(url) {
    if (channelUrlIsDisplayed(url)) {
        return;
    }
    document.getElementById('url-list').appendChild(newChannelUrlListItem(url));
    CHANNEL_URL_ADDED_HANDLERS.forEach(handler => handler(url));
}


function hideChannelUrl(url) {
    document.querySelectorAll('url-list li').forEach(item => {
        if (item.textContent !== url) return;

        item.remove();
    });
    CHANNEL_URL_REMOVED_HANDLERS.forEach(handler => handler(url));
}


function processForm(e) {
    if (e.preventDefault) e.preventDefault();

    console.log("Submitted");
    let form = e.currentTarget;
    displayChannelUrl(document.getElementById('urls-input').value);
    // return false to prevent the default form behavior
    return false;
}


function addChannelUrlAddedHandler(handler) {
    CHANNEL_URL_ADDED_HANDLERS.push(handler);
}

function addChannelUrlRemovedHandler(handler) {
    CHANNEL_URL_REMOVED_HANDLERS.push(handler);
}

window.onload = function () {
    let form = document.getElementById('url-form');

    if (form.attachEvent) {
        form.attachEvent("submit", processForm);
    } else {
        form.addEventListener("submit", processForm);
    }
};