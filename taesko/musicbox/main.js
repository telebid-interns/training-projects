const loadedChannels = [];


function getAPIKey() {
    return 'AIzaSyAHhFtmNEo9TwEN90p6yyZg43_4MKCiyyQ'
}


const SongDataAPI = {
    apiObj: new LastFM({
        apiKey: 'c2933b27a78e04c4b094a1a094bc2c9c',
        apiSecret: '51305668ff35178ee80976315a52042'
    }),

    test: () => {
        /* Create a cache object */

        /* Create a LastFM object */
        /* Load some artist info. */
        SongDataAPI.apiObj.artist.getInfo({artist: 'The xx'}, {
            success: function (data) {
                console.log(data)
                /* Use data. */
            }, error: function (code, message) {
                /* Show error message. */
            }
        });
    },

    getTrackInfo: (artist, track) => {
        return new Promise((resolve, reject) => {
            function resolveData(data) {
                console.log('lastfm data', data);
                resolve(data);
            }
            SongDataAPI.apiObj.track.getInfo(
                {artist, track},
                {
                    success: resolveData,
                    error: (code, message) => {
                        alert("Error message " + message);
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

    channelInfoFromName: async name => {
        let response = await gapi.client.youtube.channels.list({
            part: 'snippet',
            forUsername: name,
        });
        return {
            id: response.result.items[0].id,
            name: name,
            title: response.result.items[0].snippet.title,
            customUrl: response.result.items[0].snippet.customUrl
        };
    },

    getDataFromUrl: async url => {
        let name = parsers.parseYoutubeUrl(url).name;
        let info = await ChannelDataAPI.channelInfoFromName(name);
        return await ChannelDataAPI.getData({
            type: 'id',
            identifier: info.id,
        })
    },

    getData: async function ({type = 'forUsername', identifier}) {
        // TODO handle errors
        let channelResponse = await gapi.client.youtube.channels.list(ChannelDataAPI.args(type, identifier));

        let customUrl = channelResponse.result.items[0].snippet.customUrl;
        let channelName = channelResponse.result.items[0].snippet.title;
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
                    title: item.snippet.title,
                    customUrl: customUrl,
                    channelName: channelName
                }
            });

    },
};


const parsers = {
    map: {},

    forUrl: (url) => {
        return parsers.map['liquicity'];
    },

    forChannelId: (id) => {
        return parsers.map['liquicity']
    },

    forChannelName: (name) => {
        return parsers.map[name.toLowerCase()];
    },

    parseLiquicity: videoTitle => {
        // TODO shorten
        let regex = new RegExp("([^-]+) - ([^-]+)");
        let result = regex.exec(videoTitle);
        if (result) {
            return {'artist': result[1], 'track': result[2]};
        }
    },

    parseTaylorSwift: videoTitle => {
        // TODO display titles which can't be parsed
        let regex = new RegExp("Taylor Swift - ([^-]+)");
        let result = regex.exec(videoTitle);
        if (result) {
            return {'artist': 'Taylor Swift', 'track': result[1]};
        }
    },

    parseYoutubeUrl: url => {
        let u = "https://www.youtube.com/user/taylorswift/videos";
        let regex = new RegExp("www.youtube.com/user/([^/]+).*");
        let result = regex.exec(url);
        if (!result) {
            alert("Could not parse url " + url);
        }
        return {id: undefined, name: result[1]};
    },

    // TODO find out how to do this
    _initialize: () => {
        parsers.map['liquicity'] = parsers.parseLiquicity;
        parsers.map['taylorswift'] = parsers.parseTaylorSwift;
    }

};
parsers._initialize();


const TableAPI = {
    displayedChannels: [],
    columnNames: ['channelName', 'artist', 'album', 'track', 'length'],
    columnIndexes: {channelName: 0, artist: 1, album: 2, track: 3, length: 4},

    addSongs: songs => {
        let tbody = document.querySelector('table tbody');
        let addedChannels = [];
        songs.forEach(song => {
            let newRow = tbody.insertRow(-1);
            for (let name of TableAPI.columnNames) {
                newRow.insertCell(-1).textContent = song[name];
            }
        });
        TableAPI.displayedChannels.push(addedChannels)
    },

    removeSongsFromChannel: name => {
        console.log("Removing songs from", name);
        document.querySelectorAll('table tbody tr')
            .forEach(row => {
                    let columns = row.getElementsByTagName('td');
                    let channelName = columns[TableAPI.columnIndexes['channelName']].textContent;
                    console.log(channelName, name);
                    if (channelName.toLowerCase() === name.toLowerCase()) {
                        row.remove();
                    }
                }
            );
        TableAPI.displayedChannels.splice(
            TableAPI.displayedChannels.indexOf(name),
            1
        )
    },

    clearTable: () => {
        document.querySelectorAll('table tbody tr')
            .forEach(row => row.remove());
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
            console.log("removed item");
            item.remove();
        });
    }
};


const SubsAPI = {
    whitelist: ['liquicity', 'maroon5', 'taylorswift'],

    subToUrl: async url => {
        let channel = parsers.parseYoutubeUrl(url).name;

        console.log("Currently subscribed channels: ", loadedChannels);

        if (SubsAPI.whitelist.indexOf(channel) === -1) {
            alert("Channel " + channel + " is not supported.");
            return
        }
        else if (loadedChannels.indexOf(channel) !== -1) {
            alert("Already subscribed to channel " + channel);
            // TODO display error
            return
        }

        console.log("Subscribing to url " + url + " with channel name = " + channel);

        let videoData = await ChannelDataAPI.getDataFromUrl(url);
        let songs = extractSongs(videoData);
        let successful = songs.filter(song => {
            return song !== undefined;
        });
        let unsuccessful = songs.filter(song => {
            return song === undefined;
        });

        if (unsuccessful) {
            alert("Some videos could not be parsed.");
        }

        console.log("Subscription to channel " + channel + " successfully parsed these songs: ", successful);
        console.log("Subscription to channel " + channel + " could not parse these videos: ", unsuccessful);

        TableAPI.addSongs(successful);
        loadedChannels.push(channel);
        UrlList.display(url);
    },

    unsubFromUrl: url => {
        let channel = parsers.parseYoutubeUrl(url).name;
        console.log("Unsubscribe from url " + url + " with channel name " + url);
        if (loadedChannels.indexOf(channel) === -1) {
            alert("You are not subscribed to " + channel);
            // TODO display errors
            return;
        }
        loadedChannels.splice(loadedChannels.indexOf(channel), 1);
        TableAPI.removeSongsFromChannel(channel);
        UrlList.hide(url)
    }
};


function extractSongs(videos) {
    return videos.map(vid => {
        let title_info = parsers.forChannelName(vid.customUrl)(vid.title);
        if (!title_info)
            return undefined;
        return {
            track: title_info.track,
            artist: title_info.artist,
            customUrl: vid.customUrl,
            channelName: vid.channelName
        }
    });
}


async function processForm(e) {
    if (e.preventDefault) e.preventDefault();

    await SubsAPI.subToUrl(document.getElementById('urls-input').value);

    await SongDataAPI.getTrackInfo('Taylor Swift', 'Troublemaker');
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
SongDataAPI.test();
