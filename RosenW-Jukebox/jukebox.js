const YT_API_KEY = 'AIzaSyDrLczSe8MEo3k5FAwo1Kc3fkn26NB-VUQ';
const LAST_FM_API_KEY = '93c3430d5a7c70eb83e5f3b1ccdc71dd';

let table = document.getElementById('infoTable');
let subBtn = document.getElementById('subBtn');
let timeSelect = document.getElementById('select-time');

let channelList = [];
let allVids = [];

if (window.localStorage.getItem('channels') != null && window.localStorage.getItem('vids') != null) {
  console.log('storage is set, getting saved data');
  channelList = JSON.parse(window.localStorage.getItem('channels'));
  allVids = JSON.parse(window.localStorage.getItem('vids'));
  showChannels();
  displayVideos();
} else {
  console.log('storage is not set, setting storage');
  updateLocalStorage();
}

timeSelect.addEventListener('change', function () {
  displayVideos();
});

subBtn.addEventListener('click', function () {
  let linkTextbox = document.getElementById('channel');
  let link = linkTextbox.value;
  linkTextbox.value = '';
  let channelId = link.split('/channel/')[1];
  let reqLink = 'https://www.googleapis.com/youtube/v3/search?channelId=' + channelId + '&key=' + YT_API_KEY + '&part=snippet&type=video&maxResults=50&videoCategoryId=10';

  makeGetRequest(reqLink, function (response) {
    let data = JSON.parse(response);
    let channelName = data.items[0].snippet.channelTitle;

    for (let i in channelList) {
      if (channelList[i].name === channelName) {
        return;
      }
    }

    let channelObj = {name: channelName, url: link};
    channelList.push(channelObj);

    let videos = data.items;

    saveAndDisplayVids(videos);
  });
});

function saveAndDisplayVids (videos) {
  for (let i in videos) {
    let videoObj = {
      artists: [],
      channelFoundOn: '',
      song: '',
      album: '',
      duration: '',
      date: ''};

    let artAndSong = extractArtistsAndSongFromTitle(videos[i].snippet.title); // setting song and artsts

    if (typeof artAndSong === 'undefined' || artAndSong.artists.length === 0) {
      continue;
    }

    videoObj.channelFoundOn = videos[i].snippet.channelTitle;
    videoObj.artists = artAndSong.artists;
    videoObj.song = artAndSong.song.trim();

    let lastfmReqLink = 'http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=' + LAST_FM_API_KEY + '&artist=' + videoObj.artists[0].trim() + '&track=' + videoObj.song + '&format=json';

    makeGetRequest(lastfmReqLink, function (response) {
      let data = JSON.parse(response);
      let album;
      let duration;

      if (data.message === 'Track not found') {
        album = 'No information';
        duration = 'No information';
      } else {
        if (typeof data.track.album === 'undefined') {
          album = 'No information';
        } else {
          album = data.track.album.title;
        }

        if (typeof data.track.duration === 'undefined' || data.track.duration === '0') {
          duration = 'No information';
        } else {
          duration = data.track.duration;
        }
      }

      videoObj.album = album;
      videoObj.duration = isNaN(duration) ? duration : millisToMinutesAndSeconds(duration);

      let vidDate = videos[i].snippet.publishedAt;
      videoObj.date = Date.parse(vidDate);

      if (videoObj.artists.length > 0 && videoObj.song.length > 0) { // pushing valid data to array
        allVids.push(videoObj);
        updateLocalStorage();
        displayVideos();
      }
      showChannels();
    });
  }
}

function showChannels () {
  // in for fix ?
  let channelsElement = document.getElementById('channels');
  channelsElement.innerHTML = '';

  for (let i in channelList) {
    let curChannel = channelList[i].name;
    let link = channelList[i].url;

    let divWrapper = document.createElement('li');
    divWrapper.setAttribute('class', 'list-group-item clearfix');
    divWrapper.setAttribute('style', 'width:20%');

    let pElement = document.createElement('p');
    pElement.setAttribute('id', 'name-' + curChannel);

    let aElement = document.createElement('a');
    aElement.setAttribute('href', link);
    aElement.setAttribute('class', 'pull-left');
    aElement.appendChild(document.createTextNode(curChannel + ' '));

    let unsubBtn = document.createElement('button');
    unsubBtn.setAttribute('class', 'btn btn-default pull-right');
    unsubBtn.setAttribute('id', 'unsub-' + curChannel);
    unsubBtn.innerHTML = 'Unsub';
    unsubBtn.addEventListener('click', function (event) {
      let chName = event.target.id.substr(6, event.target.id.length);

      channelList = channelList.filter(e => e.name !== chName);
      let removeElement = document.getElementById('name-' + chName);
      removeElement.remove();

      allVids = allVids.filter(e => e.channelFoundOn !== chName);
      updateLocalStorage();
      displayVideos();
    });

    pElement.appendChild(aElement);
    pElement.appendChild(unsubBtn);
    divWrapper.appendChild(pElement);
    channelsElement.appendChild(divWrapper);
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
  lastYear.setDate(1);
  lastYear.setYear(lastYear.getFullYear() - 1);
  return Date.parse(lastYear);
}

function displayVideos () {
  cleanTable(); // use async await
  for (let i in allVids) {
    if (checkFilter(allVids[i].date)) {
      addVideoToTable(allVids[i]);
    }
  }
}

function checkFilter (checkDate) {
  let filterElement = document.getElementById('select-time');
  let filterValue = filterElement.options[filterElement.selectedIndex].value;

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
  while (document.getElementsByTagName('tr')[1]) {
    document.getElementsByTagName('tr')[1].remove();
  }
}

function addVideoToTable (video) {
  let row = table.insertRow(-1);

  let channelCell = row.insertCell(0);
  let artistCell = row.insertCell(1);
  let songCell = row.insertCell(2);
  let durationCell = row.insertCell(3);
  let albumCell = row.insertCell(4);

  let artistText = document.createTextNode(video.artists.join(', '));
  let songText = document.createTextNode(video.song);
  let channelText = document.createTextNode(video.channelFoundOn);
  let albumText = document.createTextNode(video.album);
  let durationText = document.createTextNode(video.duration);

  artistCell.appendChild(artistText);
  songCell.appendChild(songText);
  channelCell.appendChild(channelText);
  albumCell.appendChild(albumText);
  durationCell.appendChild(durationText);
}

function extractArtistsAndSongFromTitle (title) {
  let regex = /^([0-9a-zA-Z\s.&']*) [-|] ([0-9a-zA-Z\s.&"'=-]*)/g;
  let match = regex.exec(title);

  let artists = [];
  let song;

  if (match == null) {
    return;
  }

  let artistGroup = match[1];
  let songGroup = match[2];

  let checkOne = checkGroupForFt(artistGroup, ' Feat. ', true);
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
      for (let i in featArtists) {
        foundArtists.push(featArtists[i]);
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

function makeGetRequest (url, callback) {
  let xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function () {
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
      callback(xmlHttp.responseText);
    }
  };

  xmlHttp.open('GET', url, true);
  try {
    xmlHttp.send(null);
  } catch (err) {
    console.log(err);
  }
}

function millisToMinutesAndSeconds (millis) {
  let minutes = Math.floor(millis / 60000);
  let seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}
