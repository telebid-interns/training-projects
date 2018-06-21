var LOADED_CHANNELS = [];
var RESPONSE;


function getAPIKey() {
    return 'AIzaSyAHhFtmNEo9TwEN90p6yyZg43_4MKCiyyQ'
}


const ChannelDataAPI = {
    args: (type, identifier) => {
        obj = {part: 'snippet,contentDetails'};
        obj[type] = identifier;
        return obj
    },

    getData: async function(type, identifier) {
        // TODO handle errors
        let channelResponse = await gapi.client.youtube.channels.list(ChannelDataAPI.args(type, identifier));
        console.log("args", ChannelDataAPI.args(type, identifier));
        console.log("Handling promise response", channelResponse);
        let playlistId = channelResponse.result.items[0].contentDetails.relatedPlaylists.uploads;
        let channel_name = channelResponse.result.items[0].snippet.title;
        console.log('playlist', playlistId);
        let playlistRespsonse = await gapi.client.youtube.playlistItems.list({
            maxResults: 25,
            part: 'snippet,contentDetails',
            playlistId
        });
        console.log("Playlist", playlistRespsonse);
        gotNewData(playlistRespsonse.result.items
            .map(item => {
                return {'title': item.snippet.title, 'channelName': channel_name}
            })
        );

    },

    getByName: name => {
        return ChannelDataAPI.getData('forUsername', name);
    },

    getById: id => {
        return ChannelDataAPI.getData('id', name);
    }
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
        return parsers.map['liquicity'];
    },

    registerParser: (pattern, func) => {
        parsers.map[pattern] = func;
    },

    parseLiquicity: videoTitle => {
        // TODO shorten
        let regex = new RegExp("([^-]+) - ([^-]+)");
        let result = regex.exec(videoTitle);
        if (result) {
            return {'artist': result[1], 'track': result[2], channel: 'Liquicity'};
        }
    },

    // TODO find out how to do this
    _initialize: () => {
        parsers.map['liquicity'] = parsers.parseLiquicity;
    }

};
parsers._initialize();


function extractSongs(videos) {
    return videos.map(vid => {
        return parsers.forChannelName(vid.channelName)(vid.title);
    });
}


function gotNewData(videoData) {
    TableAPI.addSongs(extractSongs(videoData))
}


function start() {
    // Initializes the client with the API key and the Translate API.
    gapi.client.init({
        'apiKey': getAPIKey(),
        'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/translate/v2/rest'],
    });
    gapi.client.load('youtube', 'v3', function () {
        console.log("youtube loaded");
        ChannelDataAPI.getByName('Liquicity');
    });
}

// Loads the JavaScript client library and invokes `start` afterwards.
gapi.load('client', start);
