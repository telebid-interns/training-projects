const YT_API_KEY = 'AIzaSyDrLczSe8MEo3k5FAwo1Kc3fkn26NB-VUQ';
const LAST_FM_API_KEY = '93c3430d5a7c70eb83e5f3b1ccdc71dd';

const NO_INFORMATION_FOUND_MSG = 'No Information';
const TRACK_NOT_FOUND_MSG = 'Track not found';

const IS_ASSERTS_ENABLED = true;

window.onerror = function (error) {
  console.log('Error Caught in global scope');
  console.log(error);
};

const table = document.getElementById('info-table');
const subBtn = document.getElementById('sub-btn');
const channelTextBox = document.getElementById('channel');
const dialog = document.getElementById('dialog');
const closeBtn = document.getElementById('close-dialog-btn');
const channelsElement = document.getElementById('channels');

subBtn.onerror = function (error) {
  console.log('on button');
};

closeBtn.addEventListener('click', dialog.close);

let channelList = [];
let allVids = [];

loadLocalStorage();

subBtn.addEventListener('click', subscribe);

function loadLocalStorage () {
  if (window.localStorage.getItem('channels') == null || window.localStorage.getItem('vids') == null) {
    console.log('storage is not set, setting storage');
    updateLocalStorage();
  } else {
    console.log('storage is set, getting saved data');
    channelList = JSON.parse(window.localStorage.getItem('channels'));
    allVids = JSON.parse(window.localStorage.getItem('vids'));
    showChannels();
    displayVideos();
  }
}

function relistChannel (channel) {
  const link = channelList.filter(e => e.name === channel)[0].link;
  const channelId = link.split('/channel/')[1];

  allVids = allVids.filter(e => e.channel !== channel);

  const params = {
    channelId: channelId,
    key: YT_API_KEY,
    part: 'snippet',
    type: 'video',
    maxResults: '50',
    videoCategoryId: '10'
  };
  const reqLink = 'https://www.googleapis.com/youtube/v3/search?' + toQueryString(params);

  makeRequest(reqLink)
  .then((data) => {
    assertPeer( // _.get (lodash)
      data.items !== undefined &&
      data.items[0].snippet !== undefined &&
      data.items[0].snippet.channelTitle !== undefined,
      'Youtube responded with wrong data'
    );
    const channelName = data.items[0].snippet.channelTitle;

    const videos = data.items;

    saveAndDisplayVids(videos);
  }).catch((err) => {
    console.log(err.message);
  });
}

function subscribe () {
  const link = channelTextBox.value;

// try {
  assertUser(link.includes('www.youtube.com/channel/'), 'Link not a youtube channel');
// } catch (e) { console.log('here'); console.log(e);}
  const channelId = link.split('/channel/')[1];
  const params = {
    channelId: channelId,
    key: YT_API_KEY,
    part: 'snippet',
    type: 'video',
    maxResults: '50',
    videoCategoryId: '10'
  };
  const reqLink = 'https://www.googleapis.com/youtube/v3/search?' + toQueryString(params);

  channelTextBox.value = '';

  makeRequest(reqLink)
    .then((data) => {
      assertPeer( // _.get (lodash)
        Array.isArray(data.items) &&
        isObject(data.items[0].snippet) &&
        typeof data.items[0].snippet.channelTitle === 'string',
        'Youtube responded with wrong data'
      );
      const channelName = data.items[0].snippet.channelTitle;

      for (const channel of channelList) {
        assertUser(channel.name !== channelName, 'Already subscribed to channel');
      }

      const channelObj = {
        name: channelName,
        link
      };
      const videos = data.items;

      channelList.push(channelObj);

      saveAndDisplayVids(videos);
    }).catch((err) => {
      console.log(err.message);
    });
}

function saveAndDisplayVids (videos) {
  const promises = [];

  for (const video of videos) {
    const videoObj = {
      artists: [],
      link: '',
      channel: '',
      song: '',
      album: '',
      duration: '',
      date: ''
    };
    const videoTitle = video.snippet.title; // remove undef
    assertPeer(videoTitle !== undefined, 'Unexpected Youtube response - video has no title');
    const artAndSong = extractArtistsAndSongFromTitle(videoTitle); // setting song and artsts

    if (artAndSong === undefined || typeof artAndSong === undefined || artAndSong.artists.length === 0) {
      console.log("Didn't recognise artist and song from video: " + videoTitle); // add to array
      continue;
    }

    assertPeer(video.snippet.channelTitle !== undefined, 'Unexpected Youtube response - channel name not present');

    videoObj.channel = video.snippet.channelTitle; // todo assert peer
    videoObj.artists = artAndSong.artists;
    videoObj.song = artAndSong.song.trim();
    console.log(videoObj.link);

    const params = {
      api_key: LAST_FM_API_KEY,
      artist: videoObj.artists[0].trim(),
      track: videoObj.song,
      format: 'json'
    };
    const lastfmReqLink = 'http://ws.audioscrobbler.com/2.0/?method=track.getInfo&' + toQueryString(params);
    const currPromise = makeRequest(lastfmReqLink)
      .then((data) => {
        if(data === undefined){
          return;
        }

        if (data.message === TRACK_NOT_FOUND_MSG) {
          videoObj.album = NO_INFORMATION_FOUND_MSG;
          videoObj.duration = NO_INFORMATION_FOUND_MSG;
        } else {
          if (data.track.album === undefined) {
            videoObj.album = NO_INFORMATION_FOUND_MSG;
          } else {
            videoObj.album = data.track.album.title;
          }

          if (typeof data.track.duration === undefined || data.track.duration === '0') { // undef ===
            videoObj.duration = NO_INFORMATION_FOUND_MSG;
          } else {
            videoObj.duration = data.track.duration;
          }
        }

        if (!isNaN(videoObj.duration)) {
          videoObj.duration = msToMinutesAndSeconds(videoObj.duration);
        }

        const vidDate = video.snippet.publishedAt;
        videoObj.date = vidDate;

        if (videoObj.artists.length > 0 && videoObj.song.length > 0) { // pushing valid data to array
          allVids.push(videoObj);
          allVids = allVids.sort((a, b) => { return new Date(b.date) - new Date(a.date); });
          updateLocalStorage();
          displayVideos();
        }
      });

    promises.push(currPromise);
  }

  Promise.all(promises).then(showChannels);
}

function showChannels () {
  let displayedChannels = channelsElement.getElementsByClassName('list-group-item');
  let channelElements = [... displayedChannels];

  for (const channel of channelList) {
    let exists = false;
    for (const li of channelElements) {
      if(li.id === channel.name){
        exists = true;
      }
    }
    if(exists) continue;

    const currChannel = channel.name;
    const link = channel.link;

    const liElement = document.createElement('li');
    const pElement = document.createElement('h4');
    const aElement = document.createElement('a');
    const brElement = document.createElement('br');
    const unsubBtn = document.createElement('button');

    liElement.setAttribute('class', 'list-group-item col-lg-4 col-md-4 col-sm-4 col-xs-4');
    liElement.setAttribute('id', currChannel);

    pElement.setAttribute('id', 'name-' + currChannel);
    pElement.setAttribute('class', 'text-center');

    aElement.setAttribute('href', link);
    aElement.appendChild(document.createTextNode(currChannel + ' '));

    unsubBtn.setAttribute('class', 'btn btn-default pull-right');
    unsubBtn.setAttribute('id', 'unsub-' + currChannel);
    unsubBtn.innerHTML = 'Unsubscribe';
    unsubBtn.addEventListener('click', function (event) {
      dialog.showModal();
      const chName = event.target.id.substr(6, event.target.id.length);
      const removeElement = document.getElementById(chName);

      channelList = channelList.filter(e => e.name !== chName);
      removeElement.remove();

      allVids = allVids.filter(e => e.channel !== chName);

      updateLocalStorage();
      showChannels();
      displayVideos();
    });

    const filterElement = document.createElement('select');
    filterElement.setAttribute('id', 'select-' + currChannel);
    filterElement.setAttribute('class', 'pull-left');
    filterElement.addEventListener('change', () => {
      relistChannel(currChannel);
    });

    const filterLabel = document.createElement('label');
    filterLabel.setAttribute('for', 'select-' + currChannel);
    filterLabel.setAttribute('class', 'pull-left');
    filterLabel.innerHTML = 'Filter by date: ';

    const lastWeekOpt = document.createElement('option');
    lastWeekOpt.setAttribute('value', 'week');
    lastWeekOpt.innerHTML = 'Last Week';

    const lastMonthOpt = document.createElement('option');
    lastMonthOpt.setAttribute('value', 'month');
    lastMonthOpt.innerHTML = 'Last Month';

    const lastYearOpt = document.createElement('option');
    lastYearOpt.setAttribute('value', 'year');
    lastYearOpt.innerHTML = 'Last Year';

    const wheneverOpt = document.createElement('option');
    wheneverOpt.setAttribute('value', 'all');
    wheneverOpt.setAttribute('selected', 'true');
    wheneverOpt.innerHTML = 'Whenever'; // make func

    filterElement.appendChild(lastWeekOpt);
    filterElement.appendChild(lastMonthOpt);
    filterElement.appendChild(lastYearOpt);
    filterElement.appendChild(wheneverOpt);

    pElement.appendChild(aElement);
    liElement.appendChild(pElement);
    liElement.appendChild(brElement);
    liElement.appendChild(filterLabel);
    liElement.appendChild(filterElement);
    liElement.appendChild(unsubBtn);
    channelsElement.appendChild(liElement);
  }
}

function updateLocalStorage () {
  window.localStorage.setItem('channels', JSON.stringify(channelList));
  window.localStorage.setItem('vids', JSON.stringify(allVids));
}

function getLastWeek () {
  let lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - lastWeek.getDay());
  return Date.parse(lastWeek);
}

function getLastMonth () {
  let lastMonth = new Date();
  lastMonth.setDate(1);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  return Date.parse(lastMonth);
}

function getLastYear () {
  let lastYear = new Date();
  lastYear.setMonth(1);
  lastYear.setYear(lastYear.getFullYear() - 1);
  return Date.parse(lastYear);
}

async function displayVideos () {
  await cleanTable();
  for (const vid of allVids) {
    if (checkFilters(Date.parse(vid.date), vid.channel)) {
      addVideoToTable(vid);
    }
  }
}

function checkFilters (checkDate, channel) {
  const filterElement = document.getElementById('select-' + channel);
  const filterValue = filterElement == null ? 'all' : filterElement.options[filterElement.selectedIndex].value;

  if (filterValue === 'week') {
    return checkDate - getLastWeek() > 0;
  } else if (filterValue === 'month') {
    return checkDate - getLastMonth() > 0;
  } else if (filterValue === 'year') {
    return checkDate - getLastYear() > 0;
  } else {
    return true;
  }
}

function cleanTable () { // ??
  const tableHeaders = ['Date', 'Artist', 'Song', 'Duration', 'Album'];
  const headers = tableHeaders.map((header) => '<th>' + header + '</th>').join('');
  table.innerHTML = `<tr>${headers}</tr>`;
}

function addVideoToTable (video) { // datafication
  let row = table.insertRow(-1);

  let dateCell = row.insertCell(0);
  let artistCell = row.insertCell(1);
  let songCell = row.insertCell(2);
  let durationCell = row.insertCell(3);
  let albumCell = row.insertCell(4);

  let artistText = document.createTextNode(video.artists.join(', '));
  let songText = document.createTextNode(video.song);
  let albumText = document.createTextNode(video.album);
  let durationText = document.createTextNode(video.duration);
  let dateText = document.createTextNode(video.date.substr(0, 10));

  artistCell.appendChild(artistText);
  songCell.appendChild(songText);
  albumCell.appendChild(albumText);
  durationCell.appendChild(durationText);
  dateCell.appendChild(dateText);
}

// Rework function
function extractArtistsAndSongFromTitle (title) {
  const titleTokens = title.split(' - ');

  let artistRegex = /(?<=vs|&|ft\.|feat\.|^)(.*?)(?=vs|&|ft\.|feat\.|$| - )/gi; // make code generated regex with []
  let songRegex = /(?<= - ).*?(?=vs|&|ft\.|feat\.|$|\(|\[)/gi;
  let songMatchArr = title.match(songRegex);

  if (songMatchArr == null) {
    return;
  }

  let artists = title.match(artistRegex);
  let song = songMatchArr[0].replace(/"/g, '').trim();

  if (artists.length === 0 || song === '' || song == null) { // notify for skip
    return;
  }

  artists = artists.map(a => a.trim());

  return {
    artists,
    song
  };
}

function msToMinutesAndSeconds (ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

// fetch wrapper
async function makeRequest(link, options){
  try {
    const response = await fetch(link, options);

    if (response.status !== 200) {
      console.log('Status Code Error: ' + response.status);
      return;
    }
    return response.json();
  } catch (error) {
    throw new PeerError('Unexpected peer response');
  }
}

function toQueryString (params) { // check type
  assert(typeof params === 'object', 'non-hash passed to function');
  // assert(params)
  const result = [];

  for (const param of Object.keys(params)) {
    result.push(`${encodeURIComponent(param)}=${encodeURIComponent(params[param])}`);
  }

  return result.join('&');
}

function handlePeerError (err) {
  console.log(err);
}

function isObject(obj){
  return typeof obj === 'object' && obj != null;
}
