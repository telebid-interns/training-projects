const MAX_VIDEO_RESULTS = 25;
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/user/';
const LASTFM_API_URL = 'http://ws.audioscrobbler.com/2.0/';

const noContentParagraph = document.getElementById('no-content-message');
const lastWeekFilter = document.getElementById('last-week-filter');
const lastMonthFilter = document.getElementById('last-month-filter');
const lastYearFilter = document.getElementById('last-year-filter');
const eternityFilter = document.getElementById('eternity-filter');

const global_subscriptions = {};

let modifyingSubscriptions = false;



class SystemError extends Error {
    constructor (message) {
        super(message);
    }
}

class ApplicationError extends Error {
    constructor (message) {
        super(message);
    }
}

class ExternalError extends Error {
    constructor (message) {
        super(message);
    }
}

class PeerError extends ExternalError {
    constructor (message) {
        super(message);
    }
}

class UserError extends ExternalError {
    constructor (message) {
        super(message);
    }
}

async function getSubscription (url) {
    async function fetchChannel (url) {
        let channelInformation = {};
        channelInformation.originalUrl = url;

        let identifiers = parseChannelFromYTUrl(url);
        let params = {};

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
            throw new UserError(
                `Youtube url - ${url} is not a link to a channel.`);
        }

        if (!hasChainedProperties(['client.youtube.channels.list'], gapi)) {
            throw new PeerError(
                `Youtube API is not behaving correctly. Missing gapi.client.youtube.channels.list`);
        }

        let response;

        try {
            response = await gapi.client.youtube.channels.list(params);
        } catch (reason) {
            throw new PeerError('Youtube API failed to provide information about channel. Reason: ' +
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
        )
            throw new PeerError(
                'Youtube API didn\'t properly provide information about channel');

        let item = response.result.items[0];

        channelInformation.id = item.id;
        channelInformation.title = item.snippet.title;
        channelInformation.customUrl = item.snippet.customUrl;
        channelInformation.playlistId = item.contentDetails.relatedPlaylists.uploads;

        return channelInformation;
    }

    async function fetchTracks (playlistId) {
        if (!hasChainedProperties(['playlistItems.list'], gapi.client.youtube))
            throw new PeerError(
                'Youtube API failed to provide information about channel uploads. Reason: renamed properties of gapi.client.youtube');

        let response;

        try {
            response = await gapi.client.youtube.playlistItems.list({
                maxResults: MAX_VIDEO_RESULTS,
                part: 'snippet,contentDetails',
                playlistId: playlistId,
            });
        } catch (reason) {
            console.log('Youtube API failed. Reason', reason);

            throw new PeerError(
                'Youtube API failed to provide information about channel uploads. Reason: API call failed');
        }

        let tracks = [];
        let failures = [];

        for (let item of response.result.items) {
            if (!hasChainedProperties(
                ['snippet.title', 'snippet.publishedAt'], item))
                throw new PeerError(
                    'Youtube API failed to provide information about channel uploads. Reason: renamed properties of response.result.items');

            let parsed = parseTrackFromVideoTitle(item.snippet.title);
            console.log('parsed', parsed);
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
        for (let track of tracks) {
            track.loadData().
                then(response => {}).
                catch(reason => { failures[track.name] = reason; });
        }
        return {tracks: tracks, failures};
    }

    let subscription = getSubByFullUrl(url);

    if (subscription) {
        console.log('found existing sub', subscription);
        return subscription;
    }

    // let errors propagate to the caller.
    subscription = await fetchChannel(url);
    let trackResponse = await fetchTracks(subscription.playlistId);

    subscription.tracks = trackResponse.tracks;
    subscription.failedToParse = trackResponse.failures;

    // let {tracks, failures} = await fetchTrackInfo(subscription.tracks);
    //
    // subscription.tracks = tracks;
    // subscription.failedToLoad = failures;

    return subscription;
}

function getSubByCustomurl (customUrl) {
    customUrl = customUrl.toLowerCase();

    for (let sub of Object.values(global_subscriptions)) {
        if (sub.customUrl.toLowerCase() === customUrl) {
            return sub;
        }
    }
}

function getSubByFullUrl (url) {
    let parsed = parseChannelFromYTUrl(url);

    if (parsed.id && global_subscriptions[parsed.id]) {
        return global_subscriptions[parsed.id];
    } else if (parsed.name) {
        let sub = getSubByCustomurl(parsed.name);

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
        this.publishedAt = publishedAt;
    }

    trackInfoUrl () {
        let params = {
            method: 'track.getInfo',
            format: 'json',
            api_key: 'c2933b27a78e04c4b094a1a094bc2c9c',
            artist: this.artistName,
            track: this.name,
        };
        let string = 'http://ws.audioscrobbler.com/2.0/?';
        for (let [key, entry] of Object.entries(params))
            string += `${encodeURIComponent(key)}=${encodeURIComponent(
                entry)}&`;
        return string;
    }

    async loadData () {
        let response;

        try {
            response = await fetch(this.trackInfoUrl());
        } catch (error) {
            throw PeerError('Couldn\'t fetch from LastFM API for track: ' +
                this.name);
        }

        if (!response.ok) {
            throw PeerError('LastFM api response is not OK for track: ' +
                this.name);
        }

        let responseData;

        try {
            responseData = await response.json();
        } catch {
            throw new PeerError('LastFM api didn\'t provide valid json in it\'s response for track: ' +
                this.name);
        }

        console.log('Last fm response', responseData);

        if (!responseData.track)
            throw new PeerError('last.fm api doesn\'t have a track property in it\'s response for track: ' +
                this.name);

        this.name = responseData.track.name;
        this.duration = responseData.track.duration;
        this.url = responseData.track.url;
        this.artistUrl = responseData.track.artist.url;
        this.album = responseData.track.album;
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
    global_subscriptions[sub.id] = sub;
    UrlList.display(sub);

    for (let track of sub.tracks) {
        try {
            await track.loadData();
        } catch (error) {
            console.warn(error);
            continue;
        }
        TableAPI.displayTrack(sub, track);
        TableAPI.showTable();
    }
}

function unsubscribe (url) {
    let sub = getSubByFullUrl(url);

    if (sub) {
        delete global_subscriptions[sub.id];
        UrlList.hide(sub);
    } else {
        alert('Already unsubscribed from ' + url);
    }

    TableAPI.hideSubscription(sub);
}

function clearSubs () {
    console.log("clearing subs");
    TableAPI.clearTable();
    for (let [key, sub] of Object.entries(global_subscriptions)) {
        delete global_subscriptions[key];
        UrlList.hide(sub);
    }
    console.log("clearing subs finished");
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
    let id;
    let name;
    let idResult = new RegExp('www.youtube.com/channel/([^/]+)').exec(url); // TODO parses query params incorrectly
    let userResult = new RegExp('www.youtube.com/user/([^/]+)').exec(url);

    if (idResult) {
        return {
            id: idResult[1],
            type: 'id',
        };
    }
    else if (userResult) {
        return {
            name: userResult[1],
            type: 'username',
        };
    }
    else {
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

    prepareChannelDialog: (dialog, songData) => {
        dialog.getElementsByTagName(
            'p')[0].textContent = songData.channel.title;
        dialog.getElementsByTagName('a')[0].setAttribute(
            'href', YOUTUBE_CHANNEL_URL + songData.channel.customUrl);
    },

    isTrackDisplayed: track => !!TableAPI.rowElements[track.id],

    displayTrack: (sub, track) => {
        if (TableAPI.isTrackDisplayed(track)) {
            console.warn(
                'Track is already displayed but tried to display it again. Track: ',
                track);
            return;
        }

        let newRow = TableAPI.tableItemTemplate.cloneNode(true);
        let title = getProp('title', sub, '');
        let artistName = getProp('artistName', track, '');
        let albumTitle = getProp('album.title', track, '');
        let trackName = getProp('name', track);
        let duration = getProp('duration', track, 0);

        newRow.classList.remove('hidden');
        newRow.removeAttribute('id');
        duration = (duration / 1000 / 60).toFixed(2).
            replace('.', ':').
            padStart(5, '0');
        // duration = duration.slice(0, 4).replace('.', ':').padStart(5, '0');

        const rowData = [
            title,
            artistName,
            albumTitle,
            trackName,
            duration,
        ];

        for (let k = 0; k < newRow.cells.length; k++) {
            newRow.cells[k].appendChild(
                document.createTextNode(rowData[k]),
            );
        }

        let dialog = newRow.cells[0].getElementsByTagName('dialog')[0];

        // TableAPI.prepareChannelDialog(dialog, song);
        // newRow.cells[0].addEventListener('click', () => {
        //     // does not work in firefox 60.0.2 for Ubunutu
        //     if(dialog.showModal === undefined) {
        //         throw SystemError("Dialog's are not supported in your browser");
        //     }
        //     dialog.showModal();
        // });

        TableAPI.rowElements[track.id] = newRow;
        TableAPI.tableBody.appendChild(newRow);
    },

    hideTrackById: id => {
        if (!TableAPI.rowElements[id]) {
            console.warn(
                'Tried to hide a track that is already hidden. Track id: ', id);
            return;
        }
        console.log("trying to remove track with id", id);
        TableAPI.rowElements[id].remove();
        delete TableAPI.rowElements[id];
    },

    hideSubscription: sub => {
        for (let track of sub.tracks) {
            console.log("hiding track", track);
            TableAPI.hideTrackById(track.id);
        }
    },

    // filterSongs: (func) => {
    //     console.log('TABLE API is filtering tracks.');
    //
    //     let filtered = Object.values(TableAPI.allSongs).
    //         filter(ele => func(ele));
    //
    //     TableAPI.showAllSongs();
    //     console.log('HIDING SONGS', filtered);
    //     TableAPI.hideSongs(filtered);
    // },
    //
    // showAllSongs: () => {
    //     for (let row of TableAPI.table.rows) {
    //         if (
    //             row.classList.contains('hidden') &&
    //             row.getAttribute('id') !== 'table-row-template'
    //         ) {
    //             row.classList.remove('hidden');
    //         }
    //     }
    // },
    //
    // hideSongs: (songs) => {
    //     for (let song of songs) {
    //         for (let row of TableAPI.table.rows) {
    //             if (
    //                 row.getAttribute('data-song-id') === songId(song) &&
    //                 !row.classList.contains('hidden')
    //             ) {
    //                 row.classList.add('hidden');
    //             }
    //         }
    //     }
    // },

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
        for (let trackId of Object.keys(TableAPI.rowElements))
            TableAPI.hideTrackById(trackId);

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
        newItem.childNodes[1].addEventListener('click', function (event) {
            unsubscribe(sub.originalUrl);
        });

        newItem.classList.remove('hidden');
        newItem.removeAttribute('id');

        return newItem;
    },

    display: sub => {
        console.log('is displayed', UrlList.isDisplayed(sub));
        if (UrlList.isDisplayed(sub))
            return;

        let listItem = UrlList.newItem(sub);
        console.log('item', listItem);

        document.getElementById('url-list').appendChild(listItem);
        UrlList.listElements.set(sub, listItem);
    },

    hide: sub => {
        console.log('unsubscribing ', sub, ' from', UrlList.listElements);
        UrlList.listElements.get(sub).remove();
        UrlList.listElements.delete(sub);
    },
};

function songIsInDateRange (song) {
    let songDate = song.publishedAt;
    let dateRange = new Date();

    if (lastWeekFilter.checked) {
        dateRange.setDate(dateRange.getDate() - 7);
    } else if (lastMonthFilter.checked) {
        dateRange.setMonth(dateRange.getMonth() - 1);
    } else if (lastYearFilter.checked) {
        dateRange.setFullYear(dateRange.getFullYear() - 1);
    } else {
        // TODO assert
        return false;
    }

    return songDate.getTime() <= dateRange.getTime();
}

function setupSubEvents (form, button) {
    let modifyingSubscriptions = false;

    async function processForm (e) {
        console.log('form submit state', modifyingSubscriptions);
        if (e.preventDefault)
            e.preventDefault();
        if (modifyingSubscriptions) {
            return;
        } else {
            modifyingSubscriptions = true;
        }

        console.log('submitting form RIGHT NOW');
        let urls = parseUrlsFromString(
            document.getElementById('urls-input').value);

        for (let url of urls) {
            await subscribe(url);
        }

        // return false to prevent the default form behavior
        modifyingSubscriptions = false;
        return false;
    }

    if (form.attachEvent) {
        form.attachEvent('submit', processForm);
    } else {
        form.addEventListener('submit', processForm);
    }

    button.addEventListener('click',
        () => {
            console.log("current handling state", modifyingSubscriptions);
            if (modifyingSubscriptions) {
                return;
            } else {
                modifyingSubscriptions = true;
                clearSubs();
            }
            modifyingSubscriptions = false;
        },
    );
}

window.onload = function () {
    gapi.load('client', start);

    let form = document.getElementById('url-form');
    let button = document.getElementById('unsubscribe-all-btn');

    setupSubEvents(form, button);

    // function selectedFilter (event) {
    //     console.log('Filtering tracks');
    //     TableAPI.filterSongs(songIsInDateRange);
    // }
    //
    // lastWeekFilter.addEventListener('click', selectedFilter);
    // lastMonthFilter.addEventListener('click', selectedFilter);
    // lastYearFilter.addEventListener('click', selectedFilter);
    // eternityFilter.addEventListener('click', selectedFilter);
};

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
