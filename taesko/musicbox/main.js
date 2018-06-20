var RESPONSE;

function getChannelVideos(channel_id) {
    let videos = [];
    gapi.client.youtube.channels.list({
        'id': channel_id,
        'part': 'snippet,contentDetails'
    }).then(function (response) {
        let playlistId = response.result.items[0].contentDetails.relatedPlaylists.uploads
        gapi.client.youtube.playlistItems.list({
            'maxResults': 25,
            'part': 'snippet,contentDetails',
            'playlistId': playlistId
        }).then(function (response) {
            RESPONSE = response;
            videos = response.result.items;
            // response.result.items[0].snippet.title
        })
    });
    return videos
}

function start() {
    // Initializes the client with the API key and the Translate API.
    gapi.client.init({
        'apiKey': 'AIzaSyAHhFtmNEo9TwEN90p6yyZg43_4MKCiyyQ',
        'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/translate/v2/rest'],
    });
    //     .then(function() {
    //   // Executes an API request, and returns a Promise.
    //   // The method name `language.translations.list` comes from the API discovery.
    //   return gapi.client.language.translations.list({
    //     q: 'hello world',
    //     source: 'en',
    //     target: 'de',
    //   });
    // }).then(function(response) {
    //   console.log(response.result.data.translations[0].translatedText);
    // }, function(reason) {
    //   console.log('Error: ' + reason.result.error.message);
    // });
    gapi.client.load('youtube', 'v3', function () {
        // console.log("youtube loaded");
        videos = getChannelVideos("UC_x5XG1OV2P6uZZ5FSM9Ttw")
    });
}

// Loads the JavaScript client library and invokes `start` afterwards.
gapi.load('client', start);
