const MAX_VIDEO_RESULTS = 25;
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/user/';

const noContentParagraph = document.getElementById('no-content-message');
const lastWeekFilter = document.getElementById('last-week-filter');
const lastMonthFilter = document.getElementById('last-month-filter');
const lastYearFilter = document.getElementById('last-year-filter');
const eternityFilter = document.getElementById('eternity-filter');

const subscriptions = {};

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

class Subscription {
    constructor(url) {
        this.originalUrl = url;

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

        gapi.client.youtube.channels.list(params).then(response => {
            if (
                !hasChainedProperties(['result.items'], response) &&
                !hasChainedProperties([
                        'snippet.title',
                        'snippet.customUrl',
                        'id',
                        'contentDetails.relatedPlaylists.upload',],
                    response.result.items[0])
            )
                throw new PeerError(
                    'Youtube API didn\'t properly provide information about channel');

            let item = response.result.items[0];
            this.id = item.id;
            this.title = item.snippet.title;
            this.customUrl = item.snippet.customUrl;
            this.playlistId = item.contentDetails.relatedPlaylists.uploads;
            this.fetchTracks().then(response => {
                this.tracks = response.tracks;
                this.failedToParse = response.failures;
            });
            // let errors propagate to the caller.
        }).catch(reason => {
            throw new PeerError('Youtube API failed to provide information about channel. Reason: ' +
                reason);
        });

    }

    async fetchTracks () {
        if (!hasChainedProperties(['playlistItems.list'], gapi.client.youtube))
            throw new PeerError(
                'Youtube API failed to provide information about channel uploads. Reason: renamed properties of gapi.client.youtube');

        let response;

        try {
            response = await gapi.client.youtube.playlistItems.list({
                maxResults: MAX_VIDEO_RESULTS,
                part: 'snippet,contentDetails',
                playlistId: this.playlistId,
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
            if(parsed.artist && parsed.track) {
                tracks.push(
                    new Track({
                        artist: parsed.artist,
                        title: parsed.track,
                        featuring: parsed.feat,
                        publishedAt: item.snippet.publishedAt,
                    })
                );
            } else {
                failures.push(item.snippet.title);
            }
        }

        return {tracks, failures};
    }

    fetchTrackInfo () {
        let failures = {};
        for (let track of this.tracks) {
            track.loadData().
                then(response => {}).
                catch(reason => { failures[track.name] = reason; });
        }
        return {tracks: this.tracks, failures};
    }
}

class Track {
    constructor ({artist, title, featuring, publishedAt}) {
        // url, duration, artistUrl, album properties are loaded and attached through the loadData async method
        this.name = title;
        this.artistName = artist;
        this.featuring = featuring;
        this.publishedAt = publishedAt;
    }

    async loadData () {
        let populateThis = (data) => {
            if (!data.track)
                throw PeerError(
                    'last.fm API did not provide track information');
            this.name = data.track.name;
            this.duration = data.track.duration;
            this.url = data.track.url;
            this.artistUrl = data.track.artist.url;
            this.album = data.track.album;
        };
        return new Promise(
            (resolve, reject) => {
                SongDataAPI.apiObj.track.getInfo(
                    {artist: this.artistName, track: this.name},
                    {
                        success: data => {
                            populateThis(data);
                            resolve(this);
                        },
                        error: (code, message) => {
                            reject(
                                `Can't fetch track information from last.fm API. Reason: ${message}.<br> Error code:${code}`);
                        },
                    },
                );
            },
        );
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


function subscribe(url) {
    let sub = new Subscription(url);
    subscriptions[sub.id] = sub;
    UrlList.display(sub);
}

function unsubscribe(url) {
    let sub = new Subscription(url);
    delete subscriptions[sub.id];
    UrlList.hide(sub);
}

function clearSubs() {
    for(let key of Object.keys(this.subs)) {
        delete subscriptions[key];
    }
    UrlList.hideAll();
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
    allSongs: {},

    prepareChannelDialog: (dialog, songData) => {
        dialog.getElementsByTagName(
            'p')[0].textContent = songData.channel.title;
        dialog.getElementsByTagName('a')[0].setAttribute(
            'href', YOUTUBE_CHANNEL_URL + songData.channel.customUrl);
    },

    addSong: song => {
        if (TableAPI.allSongs.hasOwnProperty(songId(song)))
            return;

        let newRow = TableAPI.tableItemTemplate.cloneNode(true);
        let duration = (song.track.duration / 1000 / 60).toString();

        newRow.classList.remove('hidden');
        newRow.removeAttribute('id');

        if (duration !== '0') {
            duration = duration.slice(0, 4).replace('.', ':').padStart(5, '0');
        } else {
            duration = '';
        }

        const SONG_DATA = [
            song.channel.title,
            song.track.artist.name,
            song.track.album.title,
            song.track.name,
            duration,
        ];

        for (let k = 0; k < newRow.cells.length; k++) {
            newRow.cells[k].appendChild(
                document.createTextNode(SONG_DATA[k]),
            );
        }

        let dialog = newRow.cells[0].getElementsByTagName('dialog')[0];

        dialog.setAttribute('id', 'dialog-' + songId(song));
        TableAPI.prepareChannelDialog(dialog, song);
        newRow.cells[0].addEventListener('click', () => {
            // does not work in firefox 60.0.2 for Ubunutu
            dialog.showModal();
        });
        newRow.setAttribute('data-song-id', songId(song));
        newRow.setAttribute('data-custom-url', song.customUrl);
        newRow.setAttribute('data-channel-title', song.channel.title);
        TableAPI.allSongs[songId(song)] = song;
        TableAPI.tableBody.appendChild(newRow);
    },

    removeSongsByChannelTitle: name => {
        console.log('Removing tracks from', name);

        let rows = document.querySelectorAll('table tbody tr');

        for (let i = 1; i < rows.length; i++) {
            let row = rows[i];
            let title = row.getAttribute('data-channel-title');

            if (title.toLowerCase() === name.toLowerCase()) {
                row.remove();
                delete TableAPI.allSongs[row.getAttribute('data-song-id')];
            }
        }
    },

    filterSongs: (func) => {
        console.log('TABLE API is filtering tracks.');

        let filtered = Object.values(TableAPI.allSongs).
            filter(ele => func(ele));

        TableAPI.showAllSongs();
        console.log('HIDING SONGS', filtered);
        TableAPI.hideSongs(filtered);
    },

    showAllSongs: () => {
        for (let row of TableAPI.table.rows) {
            if (
                row.classList.contains('hidden') &&
                row.getAttribute('id') !== 'table-row-template'
            ) {
                row.classList.remove('hidden');
            }
        }
    },

    hideSongs: (songs) => {
        for (let song of songs) {
            for (let row of TableAPI.table.rows) {
                if (
                    row.getAttribute('data-song-id') === songId(song) &&
                    !row.classList.contains('hidden')
                ) {
                    row.classList.add('hidden');
                }
            }
        }
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
        for (let row of document.querySelectorAll('table tbody tr')) {
            row.remove();
        }

        TableAPI.hideTable();
        TableAPI.allSongs = {};
    },

};

const UrlList = {

    listElements: new WeakMap(),

    isDisplayed: sub => !!UrlList.listElements[sub],

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
        if (UrlList.isDisplayed(sub))
            return;

        let listItem = UrlList.newItem(sub);
        document.getElementById('url-list').appendChild(listItem);
        UrlList.listElements[sub] = listItem;
    },

    hide: sub => {
        UrlList.listElements[sub].remove();
    },

    hideAll: () => {
        for (let [key, element] of Object.entries(UrlList.listElements)) {
            element.remove();
            delete UrlList.listElements[key];
        }
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


function setupFormProcessing(form) {
    function processForm (e) {
        if (e.preventDefault) e.preventDefault();

        let urls = parseUrlsFromString(document.getElementById('urls-input').value);

        for (let url of urls) {
            subscribe(url);
        }

        // return false to prevent the default form behavior
        return false;
    }

    if (form.attachEvent) {
        form.attachEvent('submit', processForm);
    } else {
        form.addEventListener('submit', processForm);
    }
}

window.onload = function () {
    gapi.load('client', start);

    let form = document.getElementById('url-form');
    setupFormProcessing(form);

    document.getElementById('unsubscribe-all-btn')
        .addEventListener('click', subscriptions.clear);

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
