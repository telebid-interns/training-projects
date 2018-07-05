const YT_API_KEY = 'AIzaSyDrLczSe8MEo3k5FAwo1Kc3fkn26NB-VUQ';
const LAST_FM_API_KEY = '93c3430d5a7c70eb83e5f3b1ccdc71dd';

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

  // class CustomError extends Error {}
  // class UserError extends CustomError {}
  // class PerrError extends CustomError {}
  // class AppError extends CustomError {}

  // window.addEventListener('error', (event) => {
  //   // event.error;
  // });

  // const assert = (condition, msg) => {
  //   if(!IS_ASSERTS_ENABLED) return;
  //   if(condition) return;

  //   throw new AppError(msg);
  // }

  // const assertPeer = (condition, msg) => {
  //   if(condition) return;

  //   throw new PerrError(msg);
  // }

  fetch(reqLink)
    .then((response) => response.json())
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

function customEscapeURI (params) { // check type
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

    if (typeof artAndSong === 'undefined' || artAndSong.artists.length === 0) {
      continue;
    }

    videoObj.channel = video.snippet.channelTitle; // todo assert peer
    videoObj.artists = artAndSong.artists;
    videoObj.song = artAndSong.song.trim();

    // escape link
    const lastfmReqLink = 'http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=' + LAST_FM_API_KEY + '&artist=' + videoObj.artists[0].trim() + '&track=' + videoObj.song + '&format=json';
    const currPromise = fetch(lastfmReqLink) // wrapper
      .then((response) => {
        return response.json();
      }).then((data) => {
        if (data.message === 'Track not found') { // const string
          videoObj.album = 'No information';
          videoObj.duration = 'No information';
        } else {
          if (data.track.album === undefined) {
            videoObj.album = 'No information';
          } else {
            videoObj.album = data.track.album.title;
          }

          if (typeof data.track.duration === 'undefined' || data.track.duration === '0') { // undef ===
            videoObj.duration = 'No information';
          } else {
            videoObj.duration = data.track.duration;
          }
        }

        if (!isNaN(videoObj.duration)) {
          videoObj.duration = millisToMinutesAndSeconds(videoObj);
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
    liElement.setAttribute('class', 'list-group-item clearfix col-lg-2 col-md-2 col-sm-2 col-xs-2');

    const pElement = document.createElement('p');
    pElement.setAttribute('id', 'name-' + currChannel);

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
  let regex = /^([0-9a-zA-Z\s.&']*) [-|] ([0-9a-zA-Z\s.&"'=-]*)/g; // simplify
  let match = regex.exec(title);

  let artists = [];
  let song;

  if (match == null) { // notify for skip
    return;
  }

  let artistGroup = match[1];
  let songGroup = match[2];

  let checkOne = checkGroupForFt(artistGroup, ' Feat. ', true); // make case insenstitive
  let checkTwo = checkGroupForFt(artistGroup, ' ft. ', true);
  let checkThree = checkGroupForFt(songGroup, ' Feat. ', false);
  let checkFour = checkGroupForFt(songGroup, ' ft. ', false);

  artists = artists.concat(checkOne.artists);
  artists = artists.concat(checkTwo.artists);
  artists = artists.concat(checkThree.artists);
  artists = artists.concat(checkFour.artists);

  if (checkOne.song !== undefined) song = checkOne.song;
  if (checkTwo.song !== undefined) song = checkTwo.song;
  if (checkThree.song !== undefined) song = checkThree.song;
  if (checkFour.song !== undefined) song = checkFour.song;

  artists = artists.filter(function (item, index) {
    if (artists.indexOf(item) === index) {
      return item;
    }
  });

  song = song.replace(/"/g, '');

  return {artists: artists, song: song};
}

// Rework function
function checkGroupForFt (group, featString, isArtistGroup) {
  let foundArtists = [];
  let song;

  if (group.includes(featString)) {
    let groupTokens = group.split(featString);

    if (isArtistGroup) {
      foundArtists.push(groupTokens[0]); // add original singer
    } else {
      song = groupTokens[0];
    }
    let feat = groupTokens[1];

    if (feat.includes(' & ')) {
      let featArtists = feat.split(' & ');
      for (const artist of featArtists) {
        foundArtists.push(artist);
      }
    } else {
      foundArtists.push(feat); // if feat artist is only one person whole group is the feat artist
    }
  } else if (isArtistGroup && !group.toLowerCase().includes(' ft. ')) {
    foundArtists.push(group); // if there isnt a feat artist whole group is the artist
  } else {
    if (group.includes(' Feat. ')) {
      song = group.split(' Feat. ')[0];
    } else if (group.includes(' ft. ')) {
      song = group.split(' ft. ')[0];
    } else {
      song = group;
    }
  }

  return {artists: foundArtists, song: song};
}

// Rework
function millisToMinutesAndSeconds (millis) {
  let minutes = Math.floor(millis / 60000);
  let seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}
