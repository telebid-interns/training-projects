const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/user/';
const loadedChannels = [];

const noContentParagraph = document.getElementById('no-content-message');
const lastWeekFilter = document.getElementById('last-week-filter');
const lastMonthFilter = document.getElementById('last-month-filter');
const lastYearFilter = document.getElementById('last-year-filter');
const eternityFilter = document.getElementById('eternity-filter');

const SongDataAPI = {
    urlBase: 'http://ws.audioscrobbler.com/2.0/?',
    apiObj: new LastFM({
        apiKey: 'c2933b27a78e04c4b094a1a094bc2c9c',
        apiSecret: '51305668ff35178ee80976315a52042'
    }),

    queryParams: params => {
        let query = '';

        for (let [key, value] of Object.entries(params)) {
            query += encodeURIComponent(key) + '&' + encodeURIComponent(value);
        }

        return query;
    },

    getTrackInfo: ({artist, track}) => {
        return new Promise((resolve, reject) => {

            SongDataAPI.apiObj.track.getInfo(
              {artist, track},
              {
                  success: resolve,
                  error: (code, message) => {
                      reject(message);
                  }
              }
            );
        });
    }
};

const ChannelDataAPI = {
    playlistMaps: {taylorswift: 'PL1CbxROoA2JivSW3W3hN9OZPMnnRphoLY'},

    args: (type, identifier) => {
        let obj = {part: 'snippet,contentDetails'};

        obj[type] = identifier;

        return obj;
    },

    _getChannelMetaFromResponseItem: item => {
        let resultObject = {id: item.id};

        if (item.hasOwnProperty('snippet')) {
            resultObject.title = item.snippet.title;
            resultObject.customUrl = item.snippet.customUrl;
        }

        return resultObject;
    },

    getChannelMeta: async ({id, userName}) => {
        let params = {part: 'snippet'};
        let resultObject = {};
        let response;

        if (id) {
            params['id'] = id;
        } else if (userName) {
            params['forUsername'] = userName;
        } else {
            throw 'Constructor requires either an id or an userName parameter to be provided';
        }

        try {
            response = await gapi.client.youtube.channels.list(params);
        } catch {
            console.log('Youtube API failed to get channel information for params: ' + params);
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

        return resultObject;
    },

    getDataFromUrl: async url => {
        let userName = parseChannelFromYTUrl(url).name;
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
        } catch (e) {
            console.log('Failed to get youtube data for params: ');
            console.log(params);
            throw 'Youtube API can\'t get channel data';
        }

        let customUrl = channelResponse.result.items[0].snippet.customUrl;
        let playlistId;
        let playlistResponse;

        if (ChannelDataAPI.playlistMaps[customUrl]) {
            playlistId = ChannelDataAPI.playlistMaps[customUrl];
        } else {
            playlistId = channelResponse.result.items[0].contentDetails.relatedPlaylists.uploads;

        }

        try {
            playlistResponse = await gapi.client.youtube.playlistItems.list({
                maxResults: 25,
                part: 'snippet,contentDetails',
                playlistId
            });
        } catch (e) {
            console.log('error occurred - ', e);
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
                  publishedAt: new Date(item.snippet.publishedAt),
                  channel: ChannelDataAPI._getChannelMetaFromResponseItem(channelResponse.result.items[0])
              };
          });

    },
};


function parseUrlsFromString(str) {
    // taken from https://stackoverflow.com/questions/6038061/regular-expression-to-find-urls-within-a-string
    let regex = new RegExp(
      '(http|ftp|https)://([\\w_-]+(?:(?:\\.[\\w_-]+)+))([\\w.,@?^=%&:/~+#-]*[\\w@?^=%&/~+#-])?',
      'g');
    let urls = [];
    let match = regex.exec(str);

    while(match) {
        urls.push(match[0]);
        match = regex.exec(str);
    }

    return urls;
}


function parseChannelFromYTUrl(url) {
    let regex = new RegExp('www.youtube.com/user/([^/]+).*');
    let result = regex.exec(url);

    if (!result) {
        console.log('Could not parse url ' + url);

        return {};
    }

    return {id: undefined, name: result[1]};
}


function parseTrackFromVideoTitle(videoTitle) {
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
        dialog.getElementsByTagName('p')[0].textContent = songData.channel.title;
        dialog.getElementsByTagName('a')[0].setAttribute('href', YOUTUBE_CHANNEL_URL + songData.channel.customUrl);
    },

    addSong: song => {
        if (TableAPI.allSongs.hasOwnProperty(songId(song)))
            return;

        let newRow = TableAPI.tableItemTemplate.cloneNode(true);
        let duration = (song.track.duration / 1000 / 60).toString();

        newRow.classList.remove('hidden');
        newRow.removeAttribute('id');

        if (duration !== '0') {
            duration = duration.slice(0, 4)
              .replace('.', ':')
              .padStart(5, '0');
        } else {
            duration = '';
        }

        const SONG_DATA = [
            song.channel.title,
            song.track.artist.name,
            song.track.album.title,
            song.track.name,
            duration
        ];

        for (let k = 0; k < newRow.cells.length; k++) {
            newRow.cells[k].appendChild(
              document.createTextNode(SONG_DATA[k])
            );
        }

        let dialog = newRow.cells[0].getElementsByTagName('dialog')[0];

        dialog.setAttribute('id', 'dialog-' + songId(song));
        TableAPI.prepareChannelDialog(dialog, song);
        newRow.cells[0].addEventListener('click', event => {
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
        console.log('Removing songs from', name);

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
        console.log('TABLE API is filtering songs.');

        let filtered = Object.values(TableAPI.allSongs)
          .filter(ele => func(ele));

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
        for(let row of document.querySelectorAll('table tbody tr')) {
            row.remove();
        }

        TableAPI.hideTable();
        TableAPI.allSongs = {};
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
        let itemTemplate = document.getElementById('url-list-item-template');
        let newItem = itemTemplate.cloneNode(true);

        newItem.childNodes[0].nodeValue = url;
        newItem.childNodes[1]
          .addEventListener('click', function (event) {
              // TODO this is a promise
              SubsAPI.unsubFromUrl(url);
          });
        newItem.classList.remove('hidden');
        newItem.removeAttribute('id');

        return newItem;
    },

    display: url => {
        if (UrlList.isDisplayed(url))
            return;

        document.getElementById('url-list').appendChild(UrlList.newItem(url));
    },

    hide: url => {
        for(let item of document.querySelectorAll('#url-list li')) {
            console.log(item.textContent, 'vs', url);

            if (item.childNodes[0].nodeValue === url)
                item.remove();

        }
    },

    hideAll: () => {
        for (let ele of document.querySelectorAll('#url-list li')) {
            if (ele.getAttribute('id') !== 'url-list-item-template')
                ele.remove();
        }
    }
};

const SubsAPI = {
    // TODO fix bad hack
    canAddTo: {'liquicity': true, 'maroon5': true, 'taylorswift': true},

    subToUrl: async url => {
        let channelUsername = parseChannelFromYTUrl(url).name;

        console.log('Currently subscribed channels: ', loadedChannels);

        if (loadedChannels.indexOf(channelUsername.toLowerCase()) !== -1) {
            //alert("Already subscribed to channel " + channelUsername);
            // TODO display error
            return;
        }

        console.log('Subscribing to url ' + url + ' with channel name = ' + channelUsername);

        let videoData = await ChannelDataAPI.getDataFromUrl(url);
        let extracted = extractSongs(videoData);
        let successful = extracted['successful'];
        let unsuccessful = extracted['unsuccessful'];

        if (unsuccessful) {
            // TODO display error
        }

        console.log('Subscription to channel ' + channelUsername + ' successfully parsed these songs: ', successful);
        console.log('Subscription to channel ' + channelUsername + ' could not parse these videos: ', unsuccessful);

        loadedChannels.push(channelUsername.toLowerCase());
        UrlList.display(url);

        let clean = {};
        for (let ele of successful)
            clean[ele.track.artist.name + ele.track.name] = ele;
        successful = Object.values(clean);
        console.log('Filtered: ', successful.filter(songIsInDateRange));

        successful.forEach(
          async song => {
              let newData;
              // sending undefined track
              // actually finds an undefined track on the artist page
              // similarly for artist
              let params = {artist: song.track.artist.name, track: song.track.name};

              try {
                  newData = await SongDataAPI.getTrackInfo(params);
              } catch (e) {
                  // TODO handle
                  console.log("lastFM API couldn't get data for params ", params);
                  return;
              }

              // TODO refactor this
              if (newData.hasOwnProperty('track')) {
                  if (newData.track.hasOwnProperty('name'))
                      song.track.name = newData.track.name;
                  if (newData.track.hasOwnProperty('artist') && newData.track.artist.hasOwnProperty('name'))
                      song.track.artist = newData.track.artist || {};
                  if (newData.track.hasOwnProperty('name'))
                      song.track.name = newData.track.name;
                  if (newData.track.hasOwnProperty('duration'))
                      song.track.duration = newData.track.duration;
                  if (newData.track.hasOwnProperty('album') && newData.track.album.hasOwnProperty('title'))
                  // not every track has an album (singles for e.g.)
                      song.track.album = newData.track.album || {};
              }

              if (SubsAPI.canAddTo[channelUsername])
                  TableAPI.addSong(song);
          }
        );

        SubsAPI.canAddTo[channelUsername] = true;
        TableAPI.showTable();
        // TODO this doesn't work right from the start because of async
        TableAPI.filterSongs(songIsInDateRange);
    },

    unsubFromUrl: async url => {
        // TODO will break if url has an id instead of user name.
        // TODO don't use an API call.
        let channelInfo = await ChannelDataAPI.getChannelMeta({userName: parseChannelFromYTUrl(url).name});
        let channelUsername = channelInfo.customUrl.toLowerCase();

        console.log('Unsubscribe from url ' + url + ' with channel name ' + channelUsername);
        console.log('All subs: ', loadedChannels);

        if (loadedChannels.indexOf(channelUsername.toLowerCase()) === -1) {
            alert('You are not subscribed to ' + channelUsername);
            // TODO display errors
            return;
        }

        SubsAPI.canAddTo[channelUsername] = false;
        TableAPI.removeSongsByChannelTitle(channelInfo.title);
        loadedChannels.splice(loadedChannels.indexOf(channelUsername.toLowerCase()), 1);
        UrlList.hide(url);
        if (loadedChannels === undefined || loadedChannels.length === 0)
            TableAPI.hideTable();
    },

    unsubFromAll: () => {
        for (let key of Object.keys(SubsAPI.canAddTo)) {
            SubsAPI.canAddTo[key] = false;
        }

        loadedChannels.length = 0;
        TableAPI.clearTable();
        UrlList.hideAll();

        for (let key of Object.keys(SubsAPI.canAddTo)) {
            SubsAPI.canAddTo[key] = true;
        }
    }
};

function songId (song) {
    return encodeURIComponent(song.track.artist.name) + '&' + encodeURIComponent(song.track.name);
}

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

function extractSongs (videos) {
    // TODO rename
    let successful = [];
    let unsuccessful = [];

    for(let vid of videos) {
        let titleInfo = parseTrackFromVideoTitle(vid.track.name);

        if (titleInfo) {
            let obj = Object.assign({}, vid);

            obj.track.artist.name = titleInfo.artist;
            obj.track.name = titleInfo.track;
            successful.push(obj);
        } else {
            unsuccessful.push(vid);
        }
    }

    return {successful, unsuccessful};
}

async function processForm (e) {
    if (e.preventDefault) e.preventDefault();

    parseUrlsFromString(
      document.getElementById('urls-input').value
    ).forEach(async url => {
        await SubsAPI.subToUrl(url);
    });

    // return false to prevent the default form behavior
    return false;
}

window.onload = function () {
    gapi.load('client', start);

    function selectedFilter (event) {
        console.log('Filtering songs');
        TableAPI.filterSongs(songIsInDateRange);
    }

    let form = document.getElementById('url-form');

    if (form.attachEvent) {
        form.attachEvent('submit', processForm);
    } else {
        form.addEventListener('submit', processForm);
    }

    document.getElementById('unsubscribe-all-btn')
      .addEventListener('click', SubsAPI.unsubFromAll);

    lastWeekFilter.addEventListener('click', selectedFilter);
    lastMonthFilter.addEventListener('click', selectedFilter);
    lastYearFilter.addEventListener('click', selectedFilter);
    eternityFilter.addEventListener('click', selectedFilter);
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
