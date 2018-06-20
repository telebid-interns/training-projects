var LOADED_CHANNELS = [];
var RESPONSE;


function getAPIKey() {
    return '***'
}


function channelVideosHook({id = '', name = '', hook}) {
    let listPromise;
    console.log("ARGUMENTS", id, name, hook);
    if(name) {
        listPromise = gapi.client.youtube.channels.list({
            'forUsername': name,
            'part': 'snippet,contentDetails'
        })
    }
    else {
        listPromise = gapi.client.youtube.channels.list({
            'id': id,
            'part': 'snippet,contentDetails'
        })
    }
    listPromise
        .then(function (response) {
            let playlistId = response.result.items[0].contentDetails.relatedPlaylists.uploads;
            let channel_name = response.result.items[0].snippet.title;
            console.log('playlist', playlistId);

            gapi.client.youtube.playlistItems.list({
                maxResults: 25,
                part: 'snippet,contentDetails',
                playlistId
            })
                .then(function (response) {
                    RESPONSE = response;
                    console.log("loaded videos for channel id", id);
                    hook(RESPONSE.result.items.map(item => {
                        return {'title': item.snippet.title, 'channelName': channel_name}
                }));
            })
    });
}


function channelIsLoaded(name) {
    return name in LOADED_CHANNELS;
}


function loadChannel(name) {
    if(!channelIsLoaded(name)) {
        channelVideosHook({
            'name': name,
            'hook': videoData => populateTable(extractSongs(videoData))
        });
    }
}


function clearChannel(name) {
    if(channelIsLoaded(name)) {
        removeChannelFromTable(name);
    }
}


const parsers = {
    map: {},

    forUrl(url) {
        return map['liquicity'];
    },

    registerParser: (pattern, func) => {
        parsers.map[pattern] = func;
    },

    parseLiquicity: videoTitle => {
        // TODO shorten
        let regex = new RegExp("([^-]+) - ([^-]+)");
        let result = regex.exec(videoTitle);
        if (result) {
            return {'artist': result[1], 'track': result[2]};
        }
    },

    // TODO find out how to do this
    _initialize: () => {
        parsers.map['liquicity'] = parsers.parseLiquicity();
    }

};
parsers._initialize();


function start() {
    // Initializes the client with the API key and the Translate API.
    gapi.client.init({
        'apiKey': getAPIKey(),
        'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/translate/v2/rest'],
    });
    gapi.client.load('youtube', 'v3', function () {
        console.log("youtube loaded");
        channelVideosHook({
            'name':"Liquicity",
            'hook': videoData => {
                TableAPI.addSongs(extractSongs(videoData))
            }
        });
    });
}

// Loads the JavaScript client library and invokes `start` afterwards.
gapi.load('client', start);
