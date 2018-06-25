'use strict';

const DEBUG_MODE = true;

const YT_CHANNELS_API = 'https://www.googleapis.com/youtube/v3/channels';
const YT_SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos';
const YT_API_KEY = 'AIzaSyDe2NF-3q_aCIi1TIW0bIN44OqHQAPEc5w';

const LFM_API = 'http://ws.audioscrobbler.com/2.0/';
const LFM_API_KEY = '545cfc729a150144d0834bf15b273835';

const SEARCH_MAX_RESULTS = 50;

const channelAddressSubmit = document.getElementById('channel-address-submit');
const addChannelAddressInputButton = document.getElementById('add-channel-address-input');
const removeAllChannelAddressInputsButton = document.getElementById('remove-all-channel-address-inputs');
const musicTable = document.getElementById('music-table');
const resultsFoundMessage = document.getElementById('results-found-message');
const searchStatus = document.getElementById('search-status');
const errorDialog = document.getElementById('error-dialog');
const closeErrorDialogButton = document.getElementById('close-error-dialog-button');
const errorDialogMessage = document.getElementById('error-dialog-message');
const artistDialog = document.getElementById('artist-dialog');
const artistImage = document.getElementById('artist-image');
const closeArtistDialogButton = document.getElementById('close-artist-dialog-button');

let resultsFound = 0;
let unsuccessfullyParsed = 0;

class ApplicationError extends Error {}
class PeerError extends Error {}
class UserError extends Error {}


function assertPeer(assertion, errorMessage) {
  if (!assertion) {
    throw new PeerError(errorMessage);
  }
}

function assertApplication(assertion, errorMessage) {
  if (!assertion) {
    throw new ApplicationError(errorMessage);
  }
}

function assertUser(assertion, errorMessage) {
  if (!assertion) {
    throw new UserError(errorMessage);
  }
}

function warning (msg) {
  if (DEBUG_MODE) {
    console.log(msg);
  }
}

function handleError (e) {

  console.log(e);

  console.log('inside handle error');

  fixAppState();

  if (e instanceof UserError) {
    errorDialogMessage.innerHTML = e.message;
  } else {
    errorDialogMessage.innerHTML = 'An unexpected error has occurred.';

    if (DEBUG_MODE) {
      console.error(e.message);
    }
  }

  errorDialog.showModal();
}

function fixAppState () {
  if (searchStatus instanceof window.HTMLParagraphElement) {
    searchStatus.style.visibility = 'hidden';
  }
}

function closeErrorDialog () {
  errorDialog.close();
}

function closeArtistDialog () {
  artistImage.src = '';
  artistDialog.close();
}

function showArtistDialog (e) {
  e.preventDefault(); // to not open link, when clicked, as new page

  assertApplication(artistImage instanceof window.HTMLImageElement, 'Element artistImage not found.');
  assertApplication(artistDialog instanceof window.HTMLDialogElement, 'Element artistDialog not found.');
  assertApplication(typeof e.target.href === 'string', `Expected typeof e.target.href to be string, but got ${typeof e.target.href}`);

  artistImage.src = e.target.href;

  artistDialog.showModal();
}

async function channelAddressSubmitOnClick () {
  const channelAddressInputsClassName = 'channel-address-input';
  let getUntilLast, channelId;

  clearTable();

  const channelAddressInputs = document.getElementsByClassName(channelAddressInputsClassName);

  // TODO escape input

  assertApplication(channelAddressInputs.length > 0, 'Element channelAddressInputs not found.');
  assertApplication(resultsFoundMessage instanceof window.HTMLParagraphElement, 'Element resultsFoundMessage not found.');

  getUntilLast = generateGetUntilLast();

  searchStatus.style.visibility = 'visible';
  searchStatus.innerHTML = 'Searching...';

  for (let i = 0; i < channelAddressInputs.length; i++) {
    let channelAddress = channelAddressInputs[i].value;
    let identificator;

    assertApplication(typeof channelAddress === 'string', `Expected typeof channelAddress to be string, but got ${typeof channelAddress}`);
    
    identificator = getChannelIdentificator(channelAddress);

    if (identificator.type === 'username') {
      
      channelId = await getChannelId(identificator.value);
    
    } else if (identificator.type === 'channelId') {
      
      channelId = identificator.value;
    
    } else {

      throw new UserError(`Sorry, "${channelAddress}" could not be recognised as a youtube channel address.`);
    }

    await getChannelVideos(channelId, getUntilLast);
  
  }

  searchStatus.style.visibility = 'visible';
  searchStatus.innerHTML = 'Finished';

  if (musicTable.style.visibility === 'hidden') { // if no results
    resultsFoundMessage.style.visibility = 'visible';
    resultsFoundMessage.innerHTML = 'No results';
  }

  saveStateToLocalStorage();
}

function generateGetUntilLast () {
  const getUntilLastElementsClassName = 'get-until-last';
  const getUntilLastElements = document.getElementsByClassName(getUntilLastElementsClassName);
  let getUntilLast;

  assertApplication(getUntilLastElements.length > 0, 'Element getUntilLastElements not found.');

  for (let i = 0; i < getUntilLastElements.length; i++) {
    
    if (!getUntilLastElements[i].checked) {
      break;
    }

    getUntilLast = getUntilLastElements[i].value;
  }

  assertUser(getUntilLast, 'Please select an option from "Get until last".');

  return getUntilLast;
}

function setGetUntilLast (getUntilLast) {
  const getUntilLastElementsClassName = 'get-until-last';
  const getUntilLastElements = document.getElementsByClassName(getUntilLastElementsClassName);

  assertApplication(getUntilLastElements, 'Element getUntilLastElements not found.');

  for (let i = 0; i < getUntilLastElements.length; i++) {
    if (getUntilLastElements[i].value === getUntilLast) {
      getUntilLastElements[i].checked = 'checked';
      break;
    }
  }
}

function addChannelAddressInput (value) {
  const channelAddressInputsId = 'channel-address-inputs';
  const channelAddressInputs = document.getElementById(channelAddressInputsId);

  assertApplication(channelAddressInputs, 'Element channelAddressInputs not found.');

  const newInput = document.createElement('input');

  newInput.type = 'text';
  newInput.className = 'channel-address-input form-control';
  newInput.placeholder = 'Link to channel';
  if (value) {
    newInput.value = value;
  }
  channelAddressInputs.appendChild(newInput);
}

function clearChannelAddressInputs () {
  const channelAddressInputsId = 'channel-address-inputs';

  clearTable();

  const channelAddressInputs = document.getElementById(channelAddressInputsId);

  assertApplication(channelAddressInputs, 'Element channelAddressInputs not found.');
  assertApplication(searchStatus instanceof window.HTMLParagraphElement, 'Element searchStatus not found.');

  searchStatus.style.visibility = 'hidden';

  while (channelAddressInputs.firstChild) {
    channelAddressInputs.removeChild(channelAddressInputs.firstChild);
  }
}

function clearTable () {
  let tableHeaderRowCount = 1;
  resultsFound = 0;
  unsuccessfullyParsed = 0;

  assertApplication(musicTable instanceof window.HTMLTableElement, 'Element musicTable not found.');
  assertApplication(resultsFoundMessage instanceof window.HTMLParagraphElement, 'Element resultsFoundMessage not found.');

  musicTable.style.visibility = 'hidden';
  resultsFoundMessage.style.visibility = 'hidden';

  for (let i = musicTable.rows.length - 1; i >= tableHeaderRowCount; i--) {
    musicTable.deleteRow(i);
  }
}

function insertTableRow (data) {

  assertApplication(musicTable instanceof window.HTMLTableElement, 'Element musicTable not found.');

  musicTable.style.visibility = 'visible';
  resultsFoundMessage.style.visibility = 'visible';
  resultsFoundMessage.innerHTML = `${resultsFound} results found.`;

  if (unsuccessfullyParsed > 0) {
    resultsFoundMessage.innerHTML += ` ${unsuccessfullyParsed} were not songs.`;
  }

  let newRow = musicTable.insertRow(musicTable.rows.length);
  let artistCell = newRow.insertCell(0);
  let songCell = newRow.insertCell(1);
  let albumCell = newRow.insertCell(2);
  let durationCell = newRow.insertCell(3);
  let releasedCell = newRow.insertCell(4);
  let channelCell = newRow.insertCell(5);

  newRow.title = data.title;

  artistCell.innerHTML = data.artists;
  songCell.innerHTML = data.songTitle;
  albumCell.innerHTML = data.album;
  durationCell.innerHTML = data.duration;
  releasedCell.innerHTML = data.publishedAt;
  channelCell.innerHTML = data.channel;

  const artistPopUps = document.getElementsByClassName('artist-pop-up');

  assertApplication(artistPopUps instanceof window.HTMLCollection, 'Element artistPopUps not found.');

  for (let i = 0; i < artistPopUps.length; i++) {
    const artistPopUp = artistPopUps[i];

    assertApplication(artistPopUp instanceof window.HTMLAnchorElement, 'Element artistPopUp, instance of HTMLAnchorElement, not found.');

    artistPopUp.onclick = showArtistDialog;
  }
}

function getTableData () {
  const tableData = [];

  assertApplication(musicTable instanceof window.HTMLTableElement, 'Element musicTable, instance of HTMLTableElement, not found.');

  for (let i = 0; i < musicTable.rows.length; i++) {
    const rowData = [];
    const item = musicTable.rows.item(i);
    const cells = item.cells;

    for (let k = 0; k < cells.length; k++) {
      rowData.push(cells.item(k).innerHTML);
    }

    rowData.push(item.title);

    tableData.push(rowData);
  }

  return tableData;
}

function saveStateToLocalStorage () {
  const state = {};
  const channelAddressInputsClassName = 'channel-address-input';
  const channelAddressInputs = document.getElementsByClassName(channelAddressInputsClassName);
  const channelAddressInputValues = [];
  let getUntilLast;
  let stateStringified;


  assertApplication(channelAddressInputs.length > 0, 'Element channelAddressInputs not found.');

  getUntilLast = generateGetUntilLast();

  for (let i = 0; i < channelAddressInputs.length; i++) {

    assertApplication(channelAddressInputs[i] instanceof window.HTMLInputElement, 'Element channelAddressInput, instance of HTMLInputElement, not found.');

    channelAddressInputValues.push(channelAddressInputs[i].value);
  }

  state.getUntilLast = getUntilLast;
  state.tableData = getTableData();


  state.channelAddressInputValues = channelAddressInputValues;
  state.resultsFound = resultsFound;
  state.unsuccessfullyParsed = unsuccessfullyParsed;

  try {

    stateStringified = JSON.stringify(state);
    window.localStorage.setItem('musicbox', stateStringified);
  } catch (e) {

    throw new ApplicationError('Failed to save app state');
  }
}

function restoreStateFromLocalStorage () {
  let state;

  try {
    let stateStringified = window.localStorage.getItem('musicbox');

    if (!stateStringified) {
      return;
    }

    state = JSON.parse(stateStringified);
  
  } catch (e) {

    throw new ApplicationError('Failed to restore app state');
  }

  if (!state) {
    return;
  }

  assertApplication(resultsFoundMessage instanceof window.HTMLParagraphElement, 'Element resultsFoundMessage, instance of HTMLParagraphElement, not found.');

  if (state.channelAddressInputValues) {
    clearChannelAddressInputs();
    state.channelAddressInputValues.forEach(value => addChannelAddressInput(value));
  }

  if (state.getUntilLast) {
    setGetUntilLast(state.getUntilLast);
  }

  if (state.tableData) {
    for (let i = 1; i < state.tableData.length; i++) {
      insertTableRow({
        artists: state.tableData[i][0],
        songTitle: state.tableData[i][1],
        album: state.tableData[i][2],
        duration: state.tableData[i][3],
        publishedAt: state.tableData[i][4],
        channel: state.tableData[i][5],
        title: state.tableData[i][6]
      });
    }
  }

  if (state.resultsFound) {
    resultsFoundMessage.innerHTML = `${state.resultsFound} results found.`;

    if (state.unsuccessfullyParsed && state.unsuccessfullyParsed > 0) {
      resultsFoundMessage.innerHTML += ` ${state.unsuccessfullyParsed} were not songs.`;
    }
  }
}

function getChannelIdentificator (channelAddress) {
  // identificator can be channel id or username
  const channelRoutePattern = /\/channel\/[^/\s]+/; // matches '/channel/channelId' in 'https://www.youtube.com/channel/channelId'
  const usernameRoutePattern = /\/user\/[^/\s]+/; // matches '/user/username' in 'https://www.youtube.com/user/username'
  const usernameShortRoutePattern = /.com\/[^/\s]+/; // matches '.com/username' in 'https://www.youtube.com/username'
  let identificator;

  if (channelAddress.match(channelRoutePattern)) {
    const channelIdMatches = channelAddress.match(channelRoutePattern);

    if (channelIdMatches.length !== 1) {
      warning(`Expected 1 match for channelRoutePattern but got ${channelIdMatches.length}.`);
    }

    const channelIdMatch = channelIdMatches[0];
    const result = channelIdMatch.replace('/channel/', '')
      .trim();

    identificator = {
      type: 'channelId',
      value: result
    };
  } else if (channelAddress.match(usernameRoutePattern)) {
    const usernameMatches = channelAddress.match(usernameRoutePattern);

    if (usernameMatches.length !== 1) {
      warning(`Expected 1 match for usernameRoutePattern but got ${usernameMatches.length}.`);
    }

    const usernameMatch = usernameMatches[0];
    const result = usernameMatch.replace('/user/', '')
      .trim();

    identificator = {
      type: 'username',
      value: result
    };
  } else if (channelAddress.match(usernameShortRoutePattern)) {
    const usernameMatches = channelAddress.match(usernameShortRoutePattern);

    if (usernameMatches.length !== 1) {
      warning(`Expected 1 match for usernameShortRoutePattern but got ${usernameMatches.length}.`);
    }

    const usernameMatch = usernameMatches[0];
    const result = usernameMatch.replace('.com/', '')
      .trim();

    identificator = {
      type: 'username',
      value: result
    };
  } else {
    throw new UserError(`Sorry, "${channelAddress}" could not be recognised as a youtube channel address.`);
  }

  if (!identificator.value) {
    throw new UserError(`Sorry, "${channelAddress}" could not be recognised as a youtube channel address.`);
  }

  return identificator;
}

function durationToString (duration) {
  let string = '';

  if (duration.hours !== null) {
    if (duration.hours < 10) {
      string += '0';
    }

    string += `${duration.hours}:`;
  }

  if (duration.minutes !== null) {
    if (duration.minutes < 10) {
      string += '0';
    }
    string += `${duration.minutes}:`;
  } else {
    string += '00:';
  }

  if (duration.seconds !== null) {
    if (duration.seconds < 10) {
      string += '0';
    }
    string += `${duration.seconds}`;
  } else {
    string += '00';
  }

  return string;
}

function parseDuration (duration) {
  const secondsPattern = /\d+(?=S)/;
  const minutesPattern = /\d+(?=M)/;
  const hoursPattern = /\d+(?=H)/;

  const secondsMatches = duration.match(secondsPattern);
  const minutesMatches = duration.match(minutesPattern);
  const hoursMatches = duration.match(hoursPattern);

  if (secondsMatches !== null && secondsMatches.length !== 1) {
    warning(`Expected 1 match for seconds but got ${secondsMatches.length}.`);
  }

  if (minutesMatches !== null && minutesMatches.length !== 1) {
    warning(`Expected 1 match for minutes but got ${minutesMatches.length}.`);
  }

  if (hoursMatches !== null && hoursMatches.length !== 1) {
    warning(`Expected 1 match for hours but got ${hoursMatches.length}.`);
  }

  return {
    seconds: (secondsMatches === null) ? null : secondsMatches[0],
    minutes: (minutesMatches === null) ? null : minutesMatches[0],
    hours: (hoursMatches === null) ? null : hoursMatches[0]
  };
}

async function getChannelId (username) {
  const channelResponse = await getJSONResponse(YT_CHANNELS_API, {
    key: YT_API_KEY,
    forUsername: username,
    part: 'id'
  });

  assertPeer(
    channelResponse !== null &&
    channelResponse.items instanceof Array &&
    channelResponse.items.length > 0 &&
    typeof channelResponse.items[0].id === 'string',

    'Youtube could not provide channel data.'
  );

  if (channelResponse.items.length !== 1) {
    warning(`Expected 1 for channelResponse.items.length but got ${channelResponse.items.length}.`);
  }

  return channelResponse.items[0].id;
}

async function getChannelVideos (channelId, getUntilLast, pageToken) {
  const date = new Date();

  if (getUntilLast === 'week') {
    date.setDate(date.getDate() - 7);
  } else if (getUntilLast === 'month') {
    date.setMonth(date.getMonth() - 1);
  } else if (getUntilLast === 'year') {
    date.setFullYear(date.getFullYear() - 1);
  } else {
    throw new ApplicationError(`Invalid value for "getUntilLast" - expected "week", "month" or "year", but got "${getUntilLast}".`);
  }

  const searchVideosResponse = await getJSONResponse(YT_SEARCH_API, {
    key: YT_API_KEY,
    channelId: channelId,
    type: 'video',
    part: 'id',
    order: 'date',
    maxResults: SEARCH_MAX_RESULTS,
    pageToken: pageToken || '',
    publishedAfter: date.toISOString()
  });

  assertPeer(
    typeof searchVideosResponse === 'object' &&
    searchVideosResponse.items instanceof Array,

    'Youtube could not provide videos.'
  );

  for (let i = 0; i < searchVideosResponse.items.length; i++) {
    let item = searchVideosResponse.items[i];
    resultsFound++;

    assertPeer(
      typeof item === 'object' &&
      typeof item.id === 'object' &&
      typeof item.id.videoId === 'string',

      'Youtube could not provide video data.'
    );

    const musicVideoData = await getMusicVideoData(item.id.videoId);

    if (Object.keys(musicVideoData).length === 0) {
      unsuccessfullyParsed++;
    } else {
      const artistNamesSeparated = separateArtists(musicVideoData.artist);
      const artistCellInnerHTML = await generateArtistCellInnerHTML(artistNamesSeparated);

      insertTableRow({
        artists: artistCellInnerHTML,
        songTitle: musicVideoData.songTitle,
        album: await getAlbum(musicVideoData),
        duration: durationToString(musicVideoData.duration),
        publishedAt: new Date(musicVideoData.publishedAt).toDateString(),
        channel: musicVideoData.channel,
        title: musicVideoData.title
      });
    }
  }

  if (searchVideosResponse.nextPageToken) {
    return getChannelVideos(channelId, getUntilLast, searchVideosResponse.nextPageToken);
  }
}

async function generateArtistCellInnerHTML (artistNames) {
  let artistCellInnerHTML = [];

  for (let k = 0; k < artistNames.length; k++) {
    const artistName = artistNames[k];

    const artistPopUp = document.createElement('a');
    artistPopUp.innerHTML = artistName;
    artistPopUp.setAttribute('href', await getArtistImage(artistName));
    artistPopUp.setAttribute('class', 'artist-pop-up');

    if (k !== 0 && k !== artistNames.length - 1) {
      artistCellInnerHTML += ', ';
    } else if (k !== 0 && k === artistNames.length - 1) {
      artistCellInnerHTML += ' & ';
    }
    artistCellInnerHTML += artistPopUp.outerHTML;
  }

  return artistCellInnerHTML;
}

function toQueryString (params) {
  const paramsList = [];

  for (const [param, val] of Object.entries(params)) {
    paramsList.push([encodeURIComponent(param), encodeURIComponent(val)]);
  }

  return paramsList.map(pair => pair.join('='))
    .join('&');
}

async function getResponse (url, queryParams) {
  return window.fetch(`${url}?${toQueryString(queryParams)}`);
}

async function getJSONResponse (url, queryParams) {
  const response = await getResponse(url, queryParams);
  return await response.json();
}

async function getMusicVideoData (videoId) {
  const artistPattern = /^.+(?= - )/; // matches 'Artist Name' in 'Artist Name - Song name (remix)'
  const titlePattern = / - [^()[\]]+/; // matches ' - Song name ' in 'Artist Name - Song name (remix)'
  let video;

  const videoData = await getJSONResponse(YT_VIDEOS_API, {
    key: YT_API_KEY,
    part: 'contentDetails,snippet',
    id: videoId
  });

  assertPeer (
    typeof videoData === 'object' &&
    videoData.items instanceof Array &&
    videoData.items.length > 0,

    'Youtube could not provide video data.'
  );

  if (videoData.items.length !== 1) {
    warning(`Expected 1 for videoData items but got ${videoData.items.length}.`);
  }

  video = videoData.items[0];

  assertPeer (
    typeof video === 'object' &&
    typeof video.snippet === 'object' &&
    typeof video.snippet.title === 'string' &&
    typeof video.snippet.publishedAt === 'string' &&
    typeof video.snippet.channelTitle === 'string' &&
    typeof video.contentDetails === 'object' &&
    typeof video.contentDetails.duration === 'string',

    'Youtube could not provide video data.'
  );

  const videoTitle = video.snippet.title;

  const artistMatches = videoTitle.match(artistPattern);

  if (artistMatches === null) {
    return {};
  }

  if (artistMatches.length !== 1) {
    warning(`Expected 1 match for artist matches but got ${artistMatches.length}.`);
  }

  const artist = artistMatches[0].trim();

  const songTitleMatches = videoTitle.match(titlePattern);

  if (songTitleMatches === null) {
    return {};
  }

  if (songTitleMatches.length !== 1) {
    warning(`Expected 1 match for song title matches but got ${songTitleMatches.length}.`);
  }

  const songTitle = songTitleMatches[0].replace(' - ', '')
    .trim();

  const duration = parseDuration(video.contentDetails.duration);

  if (duration === null) {
    return {};
  }

  const publishedAt = video.snippet.publishedAt;
  const channel = video.snippet.channelTitle;
  const title = video.snippet.title;

  return {
    artist,
    songTitle,
    duration,
    publishedAt,
    channel,
    title
  };
}

function separateArtists (artistsString) {
  const artistPattern = /[\w\s]+/g;

  return artistsString.match(artistPattern)
    .map(artist => artist.trim());
}

async function getAlbum (musicVideoData) {
  assertApplication (
    typeof musicVideoData === 'object' &&
    typeof musicVideoData.artist === 'string' &&
    typeof musicVideoData.songTitle === 'string',

    'Invalid function argument object format.'
  );

  const albumData = await getJSONResponse(LFM_API, {
    method: 'track.getInfo',
    api_key: LFM_API_KEY,
    artist: musicVideoData.artist,
    track: musicVideoData.songTitle,
    format: 'json'
  });

  assertPeer (
    typeof albumData === 'object' &&
    typeof albumData.track === 'object' &&
    typeof albumData.track.album === 'object' &&
    typeof albumData.track.album.title === 'string',

    'LAST.FM could not provide album data.'
  );

  return albumData.track.album.title;
}

async function getArtistImage (artist) {
  const artistData = await getJSONResponse(LFM_API, {
    method: 'artist.getInfo',
    api_key: LFM_API_KEY,
    artist: artist,
    format: 'json'
  });

  assertPeer (
    typeof artistData === 'object' &&
    typeof artistData.artist === 'object' &&
    artistData.artist.image instanceof Array &&
    artistData.artist.image.length > 0 &&
    typeof artistData.artist.image[artistData.artist.image.length - 1] === 'object' &&
    typeof artistData.artist.image[artistData.artist.image.length - 1]['#text'] === 'string',

    'LAST.FM could not provide artist data.'
  );

  const image = artistData.artist.image[artistData.artist.image.length - 1]['#text'];

  return image;
}

channelAddressSubmit.onclick = channelAddressSubmitOnClick;
addChannelAddressInputButton.onclick = () => addChannelAddressInput();
removeAllChannelAddressInputsButton.onclick = () => {
  clearChannelAddressInputs();
  addChannelAddressInput();
  saveStateToLocalStorage();
};
closeErrorDialogButton.onclick = closeErrorDialog;
closeArtistDialogButton.onclick = closeArtistDialog;

musicTable.style.visibility = 'hidden';
resultsFoundMessage.style.visibility = 'hidden';
searchStatus.style.visibility = 'hidden';
restoreStateFromLocalStorage();

// window.onunhandledrejection = (event) => {
//   console.log('test');
// }

window.addEventListener('error', (event) => handleError(error));
window.addEventListener('unhandledrejection', (event) => { 
  console.log('unhandledrejection');
  // handleError(error);
});

window.addEventListener('rejectionhandled', (event) => { 
  console.log('rejectionhandled');
  // handleError(error);
});