const NO_CONTENT_PARAGRAPH = document.getElementById('no-content-message');
const loadedChannels = [];


function getAPIKey() {
    return 'AIzaSyAHhFtmNEo9TwEN90p6yyZg43_4MKCiyyQ'
}


const SongDataAPI = {
    apiObj: new LastFM({
        apiKey: 'c2933b27a78e04c4b094a1a094bc2c9c',
        apiSecret: '51305668ff35178ee80976315a52042'
    }),

    getTrackInfo: ({artist, track}) => {
        return new Promise((resolve, reject) => {
            function resolveData(data) {
                resolve(data);
            }

            SongDataAPI.apiObj.track.getInfo(
                {artist, track},
                {
                    success: resolveData,
                    error: (code, message) => {
                        reject(message);
                    }
                }
            )
        });
    }
};

const ChannelDataAPI = {
    playlistMaps: {taylorswift: 'PL1CbxROoA2JivSW3W3hN9OZPMnnRphoLY'},

    args: (type, identifier) => {
        let obj = {part: 'snippet,contentDetails'};
        obj[type] = identifier;
        return obj
    },

    _getChannelMetaFromResponseItem: item => {
        let resultObject = {id: item.id};

        if (item.hasOwnProperty('snippet')) {
            resultObject.title = item.snippet.title;
            resultObject.customUrl = item.snippet.customUrl;
        }
        return resultObject
    },

    getChannelMeta: async ({id, userName}) => {
        let params = {part: 'snippet'};

        if (id) {
            params['id'] = id;
        }
        else if (userName) {
            params['forUsername'] = userName;
        }
        else {
            throw "Constructor requires either an id or an userName parameter to be provided";
        }

        let resultObject = {};
        let response;

        try {
            response = await gapi.client.youtube.channels.list(params);
        }
        catch {
            console.log("Youtube API failed to get channel information for params: " + params);
            resultObject.id = resultObject.id || '';
            resultObject.title = resultObject.title || '';
            resultObject.customUrl = resultObject.customUrl || '';
            return resultObject;
        }

        let meta = response.result.items[0];
        resultObject.id = meta.id;
        if (meta.hasOwnProperty('snippet')) {
            resultObject.title = meta.snippet.title;
            resultObject.customUrl = meta.snippet.customUrl;
        }
        return resultObject
    },

    getDataFromUrl: async url => {
        let userName = parsers.parseYoutubeUrl(url).name;
        let channelMeta = await ChannelDataAPI.getChannelMeta({userName});
        return await ChannelDataAPI.getData({
            type: 'id',
            identifier: channelMeta.id
        });
    },

    getData: async function ({type = 'forUsername', identifier}) {
        // TODO handle errors
        let channelResponse;
        let params = ChannelDataAPI.args(type, identifier);
        try {
            channelResponse = await gapi.client.youtube.channels.list(params);
        }
        catch (e) {
            console.log("Failed to get youtube data for params: ");
            console.log(params);
            throw "Youtube API can't get channel data";
        }

        let customUrl = channelResponse.result.items[0].snippet.customUrl;
        let playlistId;
        let playlistResponse;

        if (ChannelDataAPI.playlistMaps[customUrl]) {
            playlistId = ChannelDataAPI.playlistMaps[customUrl];
        }
        else {
            playlistId = channelResponse.result.items[0].contentDetails.relatedPlaylists.uploads;

        }

        try {
            playlistResponse = await gapi.client.youtube.playlistItems.list({
                maxResults: 25,
                part: 'snippet,contentDetails',
                playlistId
            });
        }
        catch (e) {
            console.log("error occurred - ", e);
            throw e;
        }

        return playlistResponse.result.items.map(
            item => {
                return {
                    id: identifier,
                    track: {
                        name: item.snippet.title,
                        artist: {
                            name: undefined,
                            lastFmUrl: undefined
                        },
                        duration: -1,
                        album: {
                            title: undefined,
                            lastFmUrl: undefined,
                            images: []
                        }
                    },
                    customUrl: customUrl,
                    channel: ChannelDataAPI._getChannelMetaFromResponseItem(channelResponse.result.items[0])
                }
            });

    },
};


const parsers = {
    parseFunctions: {},

    forChannelName: (name) => parsers.parseFunctions[name] || parsers.parseVevo,

    // TODO display titles which can't be parsed
    parseLiquicity: videoTitle => {
        let regex = /([^-]+) - ([^-]+)/;
        let result = regex.exec(videoTitle);
        if (!result) {
            alert("Could not parse title + " + videoTitle);
            return {};
        }
        return {'artist': result[1], 'track': result[2]};
    },

    parseTaylorSwift: videoTitle => {
        let regex = /Taylor Swift - ([^-]+)/;
        let result = regex.exec(videoTitle);

        if (!result) {
            alert("Could not parse title + " + videoTitle);
            return {};
        }
        return {'artist': 'Taylor Swift', 'track': result[1]};
    },

    parseYoutubeUrl: url => {
        let regex = new RegExp("www.youtube.com/user/([^/]+).*");
        let result = regex.exec(url);

        if (!result) {
            alert("Could not parse url " + url);
            return {};
        }
        return {id: undefined, name: result[1]};
    },

    parseVevo: videoTitle => {
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
            console.log("Could not parse title " + videoTitle);
            return {};
        }
        result = result.map(ele => {
            if(ele)
                return ele.trim();
            return ele;
        });

        return {artist: result[1], track: result[2], feat};
    },

    parseInputUrls: str => {
        // taken from https://stackoverflow.com/questions/6038061/regular-expression-to-find-urls-within-a-string
        let regex = new RegExp(
            "(http|ftp|https)://([\\w_-]+(?:(?:\\.[\\w_-]+)+))([\\w.,@?^=%&:/~+#-]*[\\w@?^=%&/~+#-])?",
            "g");
        let match;
        let urls = [];

        do {
            match = regex.exec(str);
            if(match) urls.push(match[0]);
            else break;

        } while(true);
        return urls
    },

    // TODO find out how to do this
    _initialize: () => {
        parsers.parseFunctions['liquicity'] = parsers.parseLiquicity;
        parsers.parseFunctions['taylorswift'] = parsers.parseTaylorSwift;
    }

};
parsers._initialize();


const TableAPI = {
    table: document.getElementsByClassName('table')[0],
    tableBody: document.querySelector('table tbody'),

    addSong: song => {
        let newRow = TableAPI.tableBody.insertRow(-1);
        [
            song.channel.title,
            song.track.artist.name,
            song.track.album.title,
            song.track.name,
            song.track.duration
        ].forEach(string => {
            newRow.insertCell(-1).textContent = string;
        });
        newRow.setAttribute('data-custom-url', song.customUrl);
    },

    removeSongsByChannelTitle: name => {
        console.log("Removing songs from", name);
        document.querySelectorAll('table tbody tr')
            .forEach(row => {
                    let title = row.childNodes[0].textContent;
                    if (title.toLowerCase() === name.toLowerCase()) {
                        row.remove();
                    }
                }
            );
    },

    showTable: () => {
        TableAPI.table.style.display = 'block';
        NO_CONTENT_PARAGRAPH.style.display = 'none';
    },

    hideTable: () => {
        TableAPI.table.style.display = 'none';
        NO_CONTENT_PARAGRAPH.style.display = 'block';
        NO_CONTENT_PARAGRAPH.textContent = '';
    },

    clearTable: () => {
        document.querySelectorAll('table tbody tr')
            .forEach(row => row.remove());
        TableAPI.hideTable();
    },

};


const UrlList = {
    isDisplayed: url => {
        let lis = document.querySelectorAll('#url-list li');
        for (let k = 0; k < lis.length; k++) {
            if (lis[k].textContent === url) {
                return true;
            }
        }
        return false;
    },

    newItem: url => {
        let li = document.createElement('li');
        let close_button = document.createElement('button');

        close_button.addEventListener("click", function (event) {
            // TODO this is a promise
            SubsAPI.unsubFromUrl(url);
        });

        li.textContent = url;
        li.appendChild(close_button);

        return li;
    },

    display: url => {
        if (UrlList.isDisplayed(url)) return;

        document.getElementById('url-list').appendChild(UrlList.newItem(url));
    },

    hide: url => {
        document.querySelectorAll('#url-list li').forEach(item => {
            if (item.textContent !== url) return;
            item.remove();
        });
    }
};


const SubsAPI = {
    // TODO fix bad hack
    canAddTo: {'liquicity': true, 'maroon5': true, 'taylorswift': true},

    subToUrl: async url => {
        let channelUsername = parsers.parseYoutubeUrl(url).name;

        console.log("Currently subscribed channels: ", loadedChannels);

        if (loadedChannels.indexOf(channelUsername) !== -1) {
            alert("Already subscribed to channel " + channelUsername);
            // TODO display error
            return
        }

        console.log("Subscribing to url " + url + " with channel name = " + channelUsername);

        let videoData = await ChannelDataAPI.getDataFromUrl(url);
        let extracted = extractSongs(videoData);
        let successful = extracted['successful'];
        let unsuccessful = extracted['unsuccessful'];

        if (unsuccessful) {
            // TODO display error
        }

        console.log("Subscription to channel " + channelUsername + " successfully parsed these songs: ", successful);
        console.log("Subscription to channel " + channelUsername + " could not parse these videos: ", unsuccessful);

        loadedChannels.push(channelUsername);
        UrlList.display(url);

        successful.forEach(
            async song => {
                let newData;
                // sending undefined track
                // actually finds an undefined track on the artist page
                // similarly for artist
                let params = {artist: song.track.artist.name, track: song.track.name};
                try {
                    newData = await SongDataAPI.getTrackInfo(params);
                }
                catch (e) {
                    // TODO handle
                    console.log("lastFM API couldn't get data for params ", params);
                    return
                }

                // TODO refactor this
                if (newData.hasOwnProperty('track')) {
                    if (newData.track.hasOwnProperty('name'))
                        song.track.name = newData.track.name;
                    if (newData.track.hasOwnProperty('artist') && newData.track.artist.hasOwnProperty('name'))
                        song.track.artist = newData.track.artist || {};
                    if (newData.track.hasOwnProperty('name'))
                        song.track.name = newData.track.name;
                    if (newData.track.hasOwnProperty('durattion'))
                        song.track.duration = newData.track.duration;
                    if (newData.track.hasOwnProperty('album') && newData.track.album.hasOwnProperty('title'))
                        // not every track has an album (singles for e.g.)
                        song.track.album = newData.track.album || {};
                }
                if (SubsAPI.canAddTo[channelUsername]) {
                    TableAPI.addSong(song);
                }
            }
        );
        SubsAPI.canAddTo[channelUsername] = true;
        TableAPI.showTable();
    },

    unsubFromUrl: async url => {
        // TODO will break if url has an id instead of user name.
        // TODO don't use an API call.
        let channelInfo = await ChannelDataAPI.getChannelMeta({userName: parsers.parseYoutubeUrl(url).name});
        let channelUsername = channelInfo.customUrl.toLowerCase();
        console.log("Unsubscribe from url " + url + " with channel name " + channelUsername);
        console.log("All subs: ", loadedChannels);
        if (loadedChannels.indexOf(channelUsername) === -1) {
            alert("You are not subscribed to " + channelUsername);
            // TODO display errors
            return;
        }
        SubsAPI.canAddTo[channelUsername] = false;
        TableAPI.removeSongsByChannelTitle(channelInfo.title);
        loadedChannels.splice(loadedChannels.indexOf(channelUsername), 1);
        UrlList.hide(url);
        if (loadedChannels !== undefined || loadedChannels.length === 0)
            TableAPI.hideTable();
    }
};


function extractSongs(videos) {
    let successful = [];
    let unsuccessful = [];
    videos.forEach(vid => {
        let titleInfo = parsers.forChannelName(vid.customUrl)(vid.track.name);
        if (titleInfo) {
            let obj = Object.assign({}, vid);
            obj.track.artist.name = titleInfo.artist;
            obj.track.name = titleInfo.track;
            successful.push(obj);
        }
        else unsuccessful.push(vid);
    });
    return {successful, unsuccessful};
}


async function processForm(e) {
    if (e.preventDefault) e.preventDefault();

    parsers.parseInputUrls(
        document.getElementById('urls-input').value
    ).forEach(async url => {
        await SubsAPI.subToUrl(url);
    });
    // return false to prevent the default form behavior
    return false;
}


window.onload = function () {
    let form = document.getElementById('url-form');

    if (form.attachEvent) {
        form.attachEvent("submit", processForm);
    } else {
        form.addEventListener("submit", processForm);
    }
};


function start() {
    // Initializes the client with the API key and the Translate API.
    gapi.client.init({
        'apiKey': getAPIKey(),
        'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/translate/v2/rest'],
    });
    gapi.client.load('youtube', 'v3', function () {
        console.log("youtube loaded");
    });
}

// Loads the JavaScript client library and invokes `start` afterwards.
gapi.load('client', start);
