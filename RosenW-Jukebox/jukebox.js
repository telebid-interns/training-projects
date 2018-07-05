const YT_API_KEY = 'AIzaSyDrLczSe8MEo3k5FAwo1Kc3fkn26NB-VUQ';
const LAST_FM_API_KEY = '93c3430d5a7c70eb83e5f3b1ccdc71dd';

const NO_INFORMATION_FOUND_MSG = 'No Information';
const TRACK_NOT_FOUND_MSG = 'Track not found';

const table = document.getElementById('info-table');
const subBtn = document.getElementById('sub-btn');
const channelTextBox = document.getElementById('channel');

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

function subscribe () {
  const link = channelTextBox.value;
  const channelId = link.split('/channel/')[1]; // user error
  const reqLink = 'https://www.googleapis.com/youtube/v3/search?channelId=' + channelId + '&key=' + YT_API_KEY + '&part=snippet&type=video&maxResults=50&videoCategoryId=10';

  channelTextBox.value = '';

  makeRequest(reqLink)
    .then((data) => {
      const channelName = data.items[0].snippet.channelTitle;

      for (const channel of channelList) {
        if (channel.name === channelName) {
          return;
        }
      }

      const channelObj = {
        name: channelName,
        url: link
      };
      const videos = data.items;

      channelList.push(channelObj);

      saveAndDisplayVids(videos);
    }).catch((err) => {
      console.log(err);
    });
}

function customEscapeURI (params) { // check type, rename
  const result = [];

  for (const param of Object.keys(params)) {
    result.push(`${encodeURIComponent(param)}=${encodeURIComponent(params[param])}`);
  }

  return result.join('&');
}

function saveAndDisplayVids (videos) {
  const promises = [];

  for (const video of videos) {
    const videoObj = {
      artists: [],
      channel: '',
      song: '',
      album: '',
      duration: '',
      date: ''
    };
    const artAndSong = extractArtistsAndSongFromTitle(video.snippet.title); // setting song and artsts

    if (artAndSong === undefined || typeof artAndSong === undefined || artAndSong.artists.length === 0) {
      continue;
    }

    videoObj.channel = video.snippet.channelTitle; // todo assert peer
    videoObj.artists = artAndSong.artists;
    videoObj.song = artAndSong.song.trim();

    // escape link
    const lastfmReqLink = 'http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=' + LAST_FM_API_KEY + '&artist=' + videoObj.artists[0].trim() + '&track=' + videoObj.song + '&format=json';
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
          videoObj.duration = millisToMinutesAndSeconds(videoObj.duration);
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
  let channelsElement = document.getElementById('channels');
  channelsElement.innerHTML = '';

  for (const channel of channelList) {
    const currChannel = channel.name;
    const link = channel.url;

    const liElement = document.createElement('li');
    liElement.setAttribute('class', 'list-group-item col-lg-4 col-md-4 col-sm-4 col-xs-4');

    const pElement = document.createElement('p');
    pElement.setAttribute('id', 'name-' + currChannel);

    const brElement = document.createElement('br');

    const aElement = document.createElement('a');
    aElement.setAttribute('href', link);
    aElement.setAttribute('class', 'pull-left');
    aElement.appendChild(document.createTextNode(currChannel + ' '));

    const unsubBtn = document.createElement('button');
    unsubBtn.setAttribute('class', 'btn btn-default pull-right');
    unsubBtn.setAttribute('id', 'unsub-' + currChannel);
    unsubBtn.innerHTML = 'Unsub';
    unsubBtn.addEventListener('click', function (event) {
      const chName = event.target.id.substr(6, event.target.id.length);
      const removeElement = document.getElementById('name-' + chName);

      channelList = channelList.filter(e => e.name !== chName);
      removeElement.remove();

      allVids = allVids.filter(e => e.channel !== chName);

      updateLocalStorage();
      showChannels();
      displayVideos();
    });

    const filterLabel = document.createElement('label');
    filterLabel.innerHTML = 'Filter by date: ';

    const filterElement = document.createElement('select');
    filterElement.setAttribute('id', 'select-' + currChannel);
    filterElement.addEventListener('change', displayVideos);

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
    wheneverOpt.innerHTML = 'Whenever';

    filterElement.appendChild(lastWeekOpt);
    filterElement.appendChild(lastMonthOpt);
    filterElement.appendChild(lastYearOpt);
    filterElement.appendChild(wheneverOpt);

    pElement.appendChild(aElement);
    pElement.appendChild(unsubBtn);
    liElement.appendChild(pElement);
    liElement.appendChild(brElement);
    liElement.appendChild(filterLabel);
    liElement.appendChild(filterElement);
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

function displayVideos () {
  cleanTable(); // use async await
  for (const vid of allVids) {
    if (checkFilters(Date.parse(vid.date), vid.channel)) { // ??
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

function cleanTable () {
  while (document.getElementsByTagName('tr')[1]) { // use for
    document.getElementsByTagName('tr')[1].remove();
  }
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
  const titleTokens = title.split(' - '); //assert

  // matches all artists (gr 1) and song (gr 2)
  // let regex = /(?<=vs|&|ft\.|feat\.|^)(.*?)(?=vs|&|ft\.|feat\.|$| - (.*?)(?=vs|&|ft\.|feat\.|$))/gmi; // works in regex101 ?

  let artistRegex = /(?<=vs|&|ft\.|feat\.|^)(.*?)(?=vs|&|ft\.|feat\.|$| - )/gi
  let songRegex = /(?<= - ).*?(?=vs|&|ft\.|feat\.|$|\(|\[)/gi;
  let songMatchArr = title.match(songRegex);

  if (songMatchArr == null) { // notify for skip
    return;
  }

  let artists = title.match(artistRegex);
  let song = songMatchArr[0];
  song = song.replace(/"/g, '');

  if (artists.length === 0 || song === '' || song == null) { // notify for skip
    return;
  }

  artists = artists.map(a => a.trim());
  song = song.trim();
  return {artists: artists, song: song};
}

// Rework
function millisToMinutesAndSeconds (millis) {
  let minutes = Math.floor(millis / 60000);
  let seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

// fetch wrapper
function makeRequest(url, options){
  let fetchPromis = fetch(url, options)
    .then(function(response) {
      if (response.status !== 200) {
        console.log('Status Code Error: ' +
        response.status);
        return;
      }

      return response.json();
    }).catch((err) => {
      console.log('smth went wrong: ' + err);
    });

  return fetchPromis;
}
