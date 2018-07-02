const MAX_VIDEO_RESULTS = 25;
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/user/';
const LAST_FM_API_URL = 'http://ws.audioscrobbler.com/2.0/';
const LAST_FM_API_KEY = 'c2933b27a78e04c4b094a1a094bc2c9c';

const loadingParagraph = document.getElementById('loading-bar');
const statusParagraph = document.getElementById('status-bar');
const noContentParagraph = document.getElementById('no-content-message');
const lastWeekFilter = document.getElementById('last-week-filter');
const lastMonthFilter = document.getElementById('last-month-filter');
const lastYearFilter = document.getElementById('last-year-filter');
const eternityFilter = document.getElementById('eternity-filter');
const subscriptionSelect = document.getElementById('sub-select');
const global_subscriptions = {};
let modifyingSubscriptions = false;
let jsonpCounter = 0;

function queryString (params) {
    let string = '?';
    for (let [key, entry] of Object.entries(params))
        string += `${encodeURIComponent(key)}=${encodeURIComponent(entry)}&`;
    return string;
}

function fetchJSONP (url, params) {
    return new Promise((resolve, reject) => {
        let callbackName = 'jsonp' + new Date().getTime() + jsonpCounter;

        jsonpCounter += 1;
        params['callback'] = callbackName;

        // TODO reject bad jsondata
        window[callbackName] = jsonData => {
            if (jsonData.error) {
                reject(jsonData.message);
            } else {
                resolve(jsonData);
            }
        };

        let script = document.createElement('script');
        script.src = url + queryString(params);
        document.getElementsByTagName('head')[0].appendChild(script);
    });
}

// TODO put this at the subscribe/unsubscribe functions instead of closures around their usages
// TODO fix nesting of lock decorators ?
const lockDecorator = (wrapped) => {
    return (...args) => {
        if (modifyingSubscriptions) {
            throw new BasicError('Please wait for subscriptions to load.',
                'Attempted to modify subscriptions while they are locked.',
                'Wrapped function:', wrapped);
        }

        modifyingSubscriptions = true;

        try {
            wrapped(...args);
        } finally {
            modifyingSubscriptions = false;
        }
    };
};

const asyncLockDecorator = (wrapped) => {
    const decorated = (...args) => {
        let promise;
        if (modifyingSubscriptions) {
            promise = Promise.reject('Please wait for subscriptions to load');
        } else {
            modifyingSubscriptions = true;
            promise = wrapped(...args);
            promise.then(unlock, unlock);
        }
        return promise;
    };

    const unlock = () => {
        modifyingSubscriptions = false;
    };

    return decorated;
};

function displayMessage (msg) {
    if (statusParagraph.timeout)
        clearTimeout(statusParagraph.timeout);

    statusParagraph.textContent = msg;

    statusParagraph.timeout = setTimeout(() => {
            statusParagraph.textContent = '';
        },
        5000);
}

class BasicError extends Error {
    constructor (userMessage, ...logArguments) {
        super(userMessage);

        console.warn(...logArguments);
        displayMessage(userMessage);
    }
}

class ApplicationError extends BasicError {
    constructor (userMessage, ...logArguments) {
        super(userMessage, ...logArguments);
        alert(userMessage);
    }
}

async function getSubscription (url) {
    async function fetchChannel (url) {
        let channelInformation = {};
        let identifiers = parseChannelFromYTUrl(url);
        let params = {};

        channelInformation.originalUrl = url;

        if (identifiers.hasOwnProperty('id') && identifiers.id.length !== 0) {
            params = {
                part: 'snippet, contentDetails',
                id: identifiers.id,
            };
        } else if (identifiers.hasOwnProperty('name') &&
            identifiers.name.length !== 0) {
            params = {
                part: 'snippet, contentDetails',
                forUsername: identifiers.name,
            };
        } else {
            throw new BasicError(
                `Youtube url - ${url} is not a link to a channel.`,
                'User tried to subscribe to incorrect url:', url);
        }

        if (!hasChainedProperties(['client.youtube.channels.list'], gapi)) {
            throw new BasicError(`We're sorry, but the applicaiton cannot download information about
            your channels because Youtube broke their API contract`,
                'Missing client.youtube.channels.list property from gapi:',
                gapi);
        }

        let response;

        try {
            response = await gapi.client.youtube.channels.list(params);
        } catch (reason) {
            throw new BasicError('Youtube API failed to provide information about channel. Reason: ' +
                reason);
        }

        if (
            !hasChainedProperties(['result.items'], response) &&
            !hasChainedProperties([
                    'snippet.title',
                    'snippet.customUrl',
                    'id',
                    'contentDetails.relatedPlaylists.upload'],
                response.result.items[0])
        ) {
            throw new BasicError(`We're sorry but the app cannot provide information about this channel
            because the Youtube broke their API contract.`,
                'Missing properties in channels.list response.');
        }

        let item = response.result.items[0];

        channelInformation.id = item.id;
        channelInformation.title = item.snippet.title;
        channelInformation.customUrl = item.snippet.customUrl;
        channelInformation.playlistId = item.contentDetails.relatedPlaylists.uploads;

        return channelInformation;
    }

    async function fetchTracks (playlistId) {
        if (!hasChainedProperties(['playlistItems.list'], gapi.client.youtube))
            throw new BasicError(
                `We're sorry but Youtube broke their API contract and our
            application cannot function at the moment.`,
                'Missing properties of playlistItems.list of gapi.client.youtube: ',
                gapi.client.youtube,
            );

        let response;

        try {
            response = await gapi.client.youtube.playlistItems.list({
                maxResults: MAX_VIDEO_RESULTS,
                part: 'snippet,contentDetails',
                playlistId: playlistId,
            });
        } catch (reason) {
            throw new BasicError(
                `We're but we cannot provide you with a list of tracks for this 
                channel because Youtube's API is not running correctly.`,
            );
        }

        let tracks = [];
        let failures = [];

        for (let item of response.result.items) {
            if (!hasChainedProperties(['snippet.title', 'snippet.publishedAt'],
                item)) {
                throw new BasicError(
                    `We're but we cannot provide you with a list of tracks for this 
                channel because Youtube's API is not running correctly.`,
                );
            }

            let parsed = parseTrackFromVideoTitle(item.snippet.title);

            if (parsed.artist && parsed.track) {
                tracks.push(
                    new Track({
                        artist: parsed.artist,
                        title: parsed.track,
                        featuring: parsed.feat,
                        publishedAt: item.snippet.publishedAt,
                    }),
                );
            } else {
                failures.push(item.snippet.title);
            }
        }

        return {tracks, failures};
    }

    async function fetchTrackInfo (tracks) {
        let failures = {};
        let successfulTracks = [];
        for (let track of tracks) {
            try {
                await track.loadData();
                successfulTracks.push(track);
            } catch (error) {
                failures[track.id] = error;
            }
        }
        return {tracks: successfulTracks, failures};
    }

    let subscription = getSubByFullURL(url);

    if (subscription) {
        return subscription;
    }

    // let errors propagate to the caller.
    subscription = await fetchChannel(url);
    let trackResponse = await fetchTracks(subscription.playlistId);

    subscription.tracks = trackResponse.tracks;
    subscription.failedToParse = trackResponse.failures;
    subscription.filterFunc = (track => true);
    subscription.filterElement = eternityFilter;

    let {tracks, failures} = await fetchTrackInfo(subscription.tracks);

    subscription.tracks = Object.values(
        tracks.reduce(
            (prev, current) => {
                prev[current.name] = current;
                return prev;
            },
            {},
        ),
    );
    subscription.failedToLoad = failures;

    return subscription;
}

function getSubByCustomURL (customUrl) {
    customUrl = customUrl.toLowerCase();

    for (let sub of Object.values(global_subscriptions)) {
        if (sub.customUrl.toLowerCase() === customUrl) {
            return sub;
        }
    }
}

function getSubByFullURL (url) {
    let parsed = parseChannelFromYTUrl(url);

    if (parsed.id && global_subscriptions[parsed.id]) {
        return global_subscriptions[parsed.id];
    } else if (parsed.name) {
        let sub = getSubByCustomURL(parsed.name);

        if (sub) {
            return sub;
        }
    }
}

class Track {
    constructor ({artist, title, featuring, publishedAt}) {
        // url, duration, artistUrl, album properties are loaded and attached through the loadData async method
        this.id = artist + title;
        this.name = title;
        this.artistName = artist;
        this.featuring = featuring;
        this.publishedAt = new Date(publishedAt);
    }

    trackInfoUrlParams () {
        return {
            method: 'track.getInfo',
            format: 'json',
            api_key: LAST_FM_API_KEY,
            artist: this.artistName,
            track: this.name,
        };
    }

    async loadData () {
        let response;

        try {
            response = await fetchJSONP(LAST_FM_API_URL,
                this.trackInfoUrlParams());
        } catch (error) {
            throw BasicError(
                `Couldn't download data from last.fm for track: ${this.name}`,
                'fetchJSONP raised error: ', error);
        }

        if (!response.track)
            throw new BasicError(`Couldn't download information for track 
            ${this.name} because last.fm broke their API contract.`,
                'Missing track property from response: ', response);

        this.name = response.track.name;
        this.duration = response.track.duration;
        this.url = response.track.url;
        this.artistUrl = response.track.artist.url;
        this.artistImageUrl = '';
        this.album = response.track.album;
    }
}

function hasChainedProperties (chainedProperties, object) {
    for (let chainedProp of chainedProperties) {
        let properties = chainedProp.split('.');
        let chainedObject = object;

        for (let prop of properties) {
            if (chainedObject[prop] === undefined)
                return false;

            chainedObject = chainedObject[prop];
        }
    }

    return true;
}

function getProp (chainedProp, object, default_) {
    for (let prop of chainedProp.split('.')) {
        if (object[prop]) {
            object = object[prop];
        } else {
            return default_;
        }
    }

    return object;
}

async function subscribe (url) {
    let sub = await getSubscription(url);

    // it's possible for a race condition to occur where
    // getSubscription returns twice two different subscriptions
    // to the same channel, because different urls can point to the same channel.
    if (global_subscriptions[sub.id]) {
        return;
    }

    let option = document.createElement('option');

    option.value = url;
    option.innerHTML = sub.title;
    subscriptionSelect.appendChild(option);
    global_subscriptions[sub.id] = sub;
    UrlList.display(sub);

    TableAPI.displaySub(sub);
    TableAPI.showTable();
}

function unsubscribe (url) {
    let sub = getSubByFullURL(url);

    for (let k = 0; k < subscriptionSelect.children.length; k++) {
        let option = subscriptionSelect.children[k];

        if (option.value.toLowerCase() === url.toLowerCase()) {
            option.remove();
            break;
        }
    }

    if (sub) {
        delete global_subscriptions[sub.id];
        UrlList.hide(sub);
    } else {
        alert('Already unsubscribed from ' + url);
    }

    TableAPI.removeSub(sub);
}

function clearSubs () {
    console.log('clearing subs');
    TableAPI.clearTable();
    for (let [key, sub] of Object.entries(global_subscriptions)) {
        delete global_subscriptions[key];
        UrlList.hide(sub);
    }

    while (subscriptionSelect.firstChild) {
        subscriptionSelect.removeChild(subscriptionSelect.firstChild);
    }
}

function parseUrlsFromString (str) {
    // taken from https://stackoverflow.com/questions/6038061/regular-expression-to-find-urls-within-a-string
    let regex = new RegExp(
        '(http|ftp|https)://([\\w_-]+(?:(?:\\.[\\w_-]+)+))([\\w.,@?^=%&:/~+#-]*[\\w@?^=%&/~+#-])?',
        'g');
    let urls = [];
    let match = regex.exec(str);

    while (match) {
        urls.push(match[0]);
        match = regex.exec(str);
    }

    return urls;
}

function parseChannelFromYTUrl (url) {
    let idResult = new RegExp('www.youtube.com/channel/([^/]+)').exec(url); // TODO parses query params incorrectly
    let userResult = new RegExp('www.youtube.com/user/([^/]+)').exec(url);

    if (idResult) {
        return {
            id: idResult[1],
            type: 'id',
        };
    } else if (userResult) {
        return {
            name: userResult[1],
            type: 'username',
        };
    } else {
        return {};
    }
}

function parseTrackFromVideoTitle (videoTitle) {
    let regex = /\s*([^_]+)\s+-\s+([^()]+)\s*/;
    let featuringRegex = /(?:ft\.|feat\.)\s*(.*)/;
    let featMatch = featuringRegex.exec(videoTitle);
    let feat;

    if (featMatch) {
        videoTitle = videoTitle.replace(featMatch[0], '');
        feat = featMatch[1];
    }

    let result = regex.exec(videoTitle);

    if (!result) {
        console.log('Could not parse title ' + videoTitle);
        return {};
    }

    result = result.map(ele => {
        if (ele)
            return ele.trim();

        return ele;
    });

    return {artist: result[1], track: result[2], feat};
}

const TableAPI = {
    table: document.getElementsByClassName('table')[0],
    tableBody: document.querySelector('table tbody'),
    tableItemTemplate: document.getElementById('table-row-template'),
    rowElements: {},

    prepareChannelDialog: (dialog, sub) => {
        dialog.getElementsByTagName('p')[0].textContent = sub.title;
        dialog.getElementsByTagName('a')[0].setAttribute(
            'href', YOUTUBE_CHANNEL_URL + sub.customUrl);
    },

    prepareArtistDialog: (dialog, track) => {
        dialog.getElementsByTagName('p')[0].textContent = track.artistName +
            '\'s last.fm page';
        dialog.getElementsByTagName('a')[0].setAttribute('href',
            track.artistUrl);
        dialog.getElementsByTagName('img')[0].setAttribute('src',
            track.artistImageUrl);
    },

    isSubDisplayed: sub => !!TableAPI.rowElements[sub.id],

    displaySub: sub => {
        if (TableAPI.isSubDisplayed(sub)) {
            console.warn(
                'Sub is already displayed but tried to display it again. Sub: ',
                sub);
            return;
        }

        TableAPI.rowElements[sub.id] = [];
        for (let track of sub.tracks) {
            if (!sub.filterFunc(track)) {
                continue;
            }

            let row = trackToRow(sub, track);

            TableAPI.rowElements[sub.id].push(row);
            TableAPI.tableBody.appendChild(row);
        }

        function trackToRow (sub, track) {
            let newRow = TableAPI.tableItemTemplate.cloneNode(true);
            let title = getProp('title', sub, '');
            let artistName = getProp('artistName', track, '');
            let albumTitle = getProp('album.title', track, '');
            let trackName = getProp('name', track);
            let publishedAt = getProp('publishedAt', track);
            let duration = parseInt(getProp('duration', track, '0'));

            newRow.classList.remove('hidden');
            newRow.removeAttribute('id');
            publishedAt = `${publishedAt.getFullYear()}-${publishedAt.getMonth()}-${publishedAt.getDate()}`;

            if (duration !== 0) {
                duration = (duration / 1000 / 60).toFixed(2).
                    replace('.', ':').
                    padStart(5, '0');
            } else {
                duration = '';
            }

            const rowData = [
                title,
                artistName,
                albumTitle,
                trackName,
                publishedAt,
                duration,
            ];

            for (let k = 0; k < newRow.cells.length; k++) {
                newRow.cells[k].appendChild(
                    document.createTextNode(rowData[k]),
                );
            }

            let dialog = newRow.cells[0].getElementsByTagName('dialog')[0];

            TableAPI.prepareChannelDialog(dialog, sub);
            TableAPI.prepareArtistDialog(
                newRow.cells[1].getElementsByTagName('dialog')[0], track);

            function dialogHook () {
                let dialogs = this.getElementsByTagName('dialog');

                if (dialogs === undefined || dialogs.length === 0)
                    throw new ApplicationError(
                        `Oops, something really bad happened with the 
                        application. You are free to refresh the page.`,
                        'Missing dialog DOM elements from: ', this);

                // does not work in firefox 60.0.2 for Ubunutu
                if (dialog.showModal === undefined) {
                    throw new BasicError(`We're sorry but displaying extra 
                    information is not supported in your browser. 
                    Please use another (chrome).`);
                }
                dialog.showModal();
            }

            for (let k = 0; k < 2; k++) {
                newRow.cells[k].addEventListener('click', dialogHook);
            }

            return newRow;
        }
    },

    removeSub: sub => {
        if (!TableAPI.rowElements[sub.id])
            return;

        for (let row of TableAPI.rowElements[sub.id]) {
            row.remove();
        }

        delete TableAPI.rowElements[sub.id];
    },

    refresh: sub => {
        TableAPI.removeSub(sub);
        TableAPI.displaySub(sub);
    },

    showTable: () => {
        TableAPI.table.classList.remove('hidden');
        noContentParagraph.classList.add('hidden');
    },

    hideTable: () => {
        TableAPI.table.classList.add('hidden');
        noContentParagraph.classList.remove('hidden');
        noContentParagraph.textContent = '';
    },

    clearTable: () => {
        for (let sub of Object.keys(TableAPI.rowElements)) {
            TableAPI.removeSub(sub);
        }
        TableAPI.hideTable();
    },

};

const UrlList = {

    listElements: new WeakMap(),

    isDisplayed: sub => UrlList.listElements.has(sub),

    newItem: sub => {
        let itemTemplate = document.getElementById('url-list-item-template');
        let newItem = itemTemplate.cloneNode(true);

        newItem.childNodes[0].nodeValue = sub.title;
        newItem.childNodes[1].addEventListener('click',
            lockDecorator(() => {
                    unsubscribe(sub.originalUrl);
                },
            ));

        newItem.classList.remove('hidden');
        newItem.removeAttribute('id');

        return newItem;
    },

    display: sub => {
        if (UrlList.isDisplayed(sub))
            return;

        let listItem = UrlList.newItem(sub);

        document.getElementById('url-list').appendChild(listItem);
        UrlList.listElements.set(sub, listItem);
    },

    hide: sub => {
        UrlList.listElements.get(sub).remove();
        UrlList.listElements.delete(sub);
    },
};

function dateFilter (until) {
    return track => {
        return track.publishedAt.getTime() >= until.getTime();
    };
}

function setupFiltering () {
    const lastWeek = new Date();
    const lastMonth = new Date();
    const lastYear = new Date();

    lastWeek.setDate(lastWeek.getDate() - 7);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    const filterFuncHash = {
        'last-week-filter': dateFilter(lastWeek),
        'last-month-filter': dateFilter(lastMonth),
        'last-year-filter': dateFilter(lastYear),
        'eternity-filter': (track => true),
    };

    function selectedFilter (event) {
        if (!subscriptionSelect.options || subscriptionSelect.options.length ===
            0)
            return;

        let sub_url = subscriptionSelect.options[subscriptionSelect.selectedIndex].value;
        let sub = getSubByFullURL(sub_url);
        sub.filterFunc = filterFuncHash[event.target.getAttribute('id')];
        sub.filterElement = event.target;
        TableAPI.refresh(sub);
    }

    function selectedSubscription (event) {
        if (!subscriptionSelect.options || subscriptionSelect.options.length ===
            0)
            return;

        let sub_url = subscriptionSelect.options[subscriptionSelect.selectedIndex].value;
        let sub = getSubByFullURL(sub_url);
        if (sub.filterElement !== undefined) {
            sub.filterElement.checked = true;
        }
    }

    subscriptionSelect.addEventListener('change', selectedSubscription);
    lastWeekFilter.addEventListener('click', selectedFilter);
    lastMonthFilter.addEventListener('click', selectedFilter);
    lastYearFilter.addEventListener('click', selectedFilter);
    eternityFilter.addEventListener('click', selectedFilter);
}

function setupSubEvents (form, button) {
    const submitUrls = asyncLockDecorator(async () => {
        let urls = parseUrlsFromString(
            document.getElementById('urls-input').value);
        let promises = urls.map(subscribe);

        loadingParagraph.textContent = 'Loading...';
        // Too slow
        //
        // let loading = true;
        // let i = 0;
        //
        // let interval = setInterval(() => {
        //     console.log("inside interval loading is", loading);
        //     if (!loading) {
        //         clearInterval(interval);
        //         loadingParagraph.textContent = ("Done.");
        //         return;
        //     }
        //     i = ++i % 4;
        //     loadingParagraph.textContent = "Loading " + Array(i+1).join('.');
        // },
        //     2000);

        await Promise.all(promises);

        loadingParagraph.textContent = '';
    });

    async function processForm (e) {
        if (e.preventDefault)
            e.preventDefault();

        try {
            await submitUrls();
        } catch (reason) {
            throw new BasicError(reason,
                'Failed to submit urls while processing form');
        }

        // return false to prevent the default form behavior
        return false;
    }

    if (form.attachEvent) {
        form.attachEvent('submit', processForm);
    } else {
        form.addEventListener('submit', processForm);
    }

    button.addEventListener('click', lockDecorator(clearSubs));
}

function start () {
    // Initializes the client with the API key and the Translate API.
    gapi.client.init({
        'apiKey': 'AIzaSyAHhFtmNEo9TwEN90p6yyZg43_4MKCiyyQ',
        'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/translate/v2/rest'],
    });

    gapi.client.load('youtube', 'v3', function () {
        console.log('youtube loaded');
    });
}

window.onload = function () {
    gapi.load('client', start);

    let form = document.getElementById('url-form');
    let button = document.getElementById('unsubscribe-all-btn');

    setupSubEvents(form, button);
    setupFiltering();

};
