'use strict';

const DEBUG_MODE = true;

const YT_CHANNELS_API = 'https://www.googleapis.com/youtube/v3/channels';
const YT_SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos';
const API_KEY = 'AIzaSyDe2NF-3q_aCIi1TIW0bIN44OqHQAPEc5w';
const SEARCH_MAX_RESULTS = 50;

const channelAddressSubmit = document.getElementById('channel-address-submit');
const addChannelAddressInputButton = document.getElementById('add-channel-address-input');
const removeAllChannelAddressInputsButton = document.getElementById('remove-all-channel-address-inputs');
const musicTable = document.getElementById('music-table');
const searchStatus = document.getElementById('search-status');

let resultsFound = 0;
let unsuccessfullyParsed = 0;

class ApplicationError extends Error {
  constructor(msg) {
    super(msg);

    if (DEBUG_MODE) {
      console.error(msg);
    }
  }
}

class DataError extends ApplicationError {
  constructor(data) {
    super(`Could not get data ${data}`);
  }
}

class ElementNotFoundError extends ApplicationError {
  constructor(identificator) {
    super(`Element '${identificator}' not found.`);
  }
}

class UnexpectedPropertyTypeError extends ApplicationError {
  constructor(real, expected) {
    super(`Expected property type ${expected}, but got ${real}.`);
  }
}

class UnexpectedValueError extends ApplicationError {
  constructor(property, value) {
    super(`Unexpected value "${value}" for property "${property}".`);
  }
}

class UserError extends Error {
  constructor(msg) {
    super(msg);
  }
}

class Warning {
  constructor(msg) {
    this.msg = msg;

    if (DEBUG_MODE) {
      console.log(msg);
    }
  }
}

function handleError(e) {
  if (e instanceof ApplicationError) {

  } else if (e instanceof UserError) {

  } else {

  }
}

async function channelAddressSubmitOnClick() {
  
  const channelAddressInputsClassName = 'channel-address-input';
  let getUntilLast, channelId;

  clearTable();

  const channelAddressInputs = document.getElementsByClassName(channelAddressInputsClassName);

  // TODO escape input

  if (channelAddressInputs.length <= 0) {

    handleError(new ElementNotFoundError(channelAddressInputsClassName));
    return;
  }

  try {

    getUntilLast = generateGetUntilLast();
  
  } catch(e) {
    
    handleError(e);
    return;
  }


  for (let i = 0; i < channelAddressInputs.length; i++) {

    let channelAddress = channelAddressInputs[i].value;
    let identificator;

    if (typeof channelAddress !== 'string') {
      
      handleError(new UnexpectedPropertyTypeError(typeof channelAddress, 'string'));
      return;
    }

    try {
      
      identificator = getChannelIdentificator(channelAddress);
  
      if (identificator.type === 'username') {

        try {

          channelId = await getChannelId(identificator.value);
        } catch(e) {

          handleError(e);
          return;
        }

      } else if (identificator.type === 'channelId') {

        channelId = identificator.value;

      } else {
        
        handleError(new UserError(`Sorry, "${channelAddress}" could not be recognised as a youtube channel address.`));
        return;
      }
  
      await getChannelVideos(channelId, getUntilLast);

    } catch(e) {

      handleError(e);
      return;
    }
  }

  if (musicTable.style.visibility === 'hidden') { // if no results 
    searchStatus.style.visibility = 'visible';
    searchStatus.innerHTML = 'No results';
  }

  saveStateToLocalStorage();
}

function generateGetUntilLast() {

  const getUntilLastElementsClassName = 'get-until-last';
  const getUntilLastElements = document.getElementsByClassName(getUntilLastElementsClassName);
  let getUntilLast;

  if (getUntilLastElements.length <= 0) {
    throw new ElementNotFoundError(getUntilLastElementsClassName);
  }

  for (let i = 0; i < getUntilLastElements.length; i++) {
    
    if (getUntilLastElements[i].checked) {
      
      getUntilLast = getUntilLastElements[i].value;
      break;
    }

  }

  if (!getUntilLast) {

    throw new UserError('Please select an option from "Get until last".');
  }

  return getUntilLast;
}

function setGetUntilLast(getUntilLast) {

  const getUntilLastElementsClassName = 'get-until-last';

  const getUntilLastElements = document.getElementsByClassName(getUntilLastElementsClassName);
  
  if (!getUntilLastElements) {
    
    handleError(new ElementNotFoundError(getUntilLastElementsClassName));
    return;
  }

  for (let i = 0; i < getUntilLastElements.length; i++) {
    
    if (getUntilLastElements[i].value === getUntilLast) {
      
      getUntilLastElements[i].checked = "checked";
      break;
    }

  }
}

function addChannelAddressInput(value) {
  const channelAddressInputsId = 'channel-address-inputs';

  const channelAddressInputs = document.getElementById(channelAddressInputsId);

  if (!channelAddressInputsId) {

    handleError(new ElementNotFoundError(channelAddressInputsId));
    return;
  }

  const newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.className = 'channel-address-input form-control';
  newInput.placeholder = 'Link to channel';
  if (value) {
    newInput.value = value;
  }
  channelAddressInputs.appendChild(newInput);
}

function clearChannelAddressInputs() {
  const channelAddressInputsId = 'channel-address-inputs';

  clearTable();
  
  const channelAddressInputs = document.getElementById(channelAddressInputsId);

  if (!channelAddressInputs) {

    handleError(new ElementNotFoundError(channelAddressInputsId));
    return;
  }

  while (channelAddressInputs.firstChild) {
    channelAddressInputs.removeChild(channelAddressInputs.firstChild);
  }
}

function clearTable() {
  let tableHeaderRowCount = 1;
  resultsFound = 0;
  unsuccessfullyParsed = 0;

  if (!(musicTable instanceof HTMLTableElement)) {
    handleError(new ElementNotFoundError('musicTable'));
    return;
  }

  if (!(searchStatus instanceof HTMLParagraphElement)) {
    handleError(new ElementNotFoundError('searchStatus'));
    return;
  }

  musicTable.style.visibility = 'hidden';
  searchStatus.style.visibility = 'hidden';

  for (let i = musicTable.rows.length - 1; i >= tableHeaderRowCount; i--) {
    musicTable.deleteRow(i);
  }

}

function insertTableRow(data) {
  if (!(musicTable instanceof HTMLTableElement)) {
    throw new ElementNotFoundError('musicTable');
  }

  musicTable.style.visibility = 'visible';
  searchStatus.style.visibility = 'visible';
  searchStatus.innerHTML = `${resultsFound} results found.`;

  if (unsuccessfullyParsed > 0) {

    searchStatus.innerHTML += ` ${unsuccessfullyParsed} were not songs.`;
  }

  let newRow = musicTable.insertRow(musicTable.rows.length);
  let artistCell = newRow.insertCell(0);
  let songCell = newRow.insertCell(1);
  let albumCell = newRow.insertCell(2);
  let durationCell = newRow.insertCell(3);
  let releasedCell = newRow.insertCell(4);
  let channelCell = newRow.insertCell(5);
  
  artistCell.innerHTML = data.artist;
  songCell.innerHTML = data.songTitle;
  albumCell.innerHTML = "";
  durationCell.innerHTML = data.duration;
  releasedCell.innerHTML = data.publishedAt;
  channelCell.innerHTML = data.channel;
}

function getTableData() {
  const tableData = [];

  if (!(musicTable instanceof HTMLTableElement)) {
    throw new ElementNotFoundError('musicTable');
  }

  for (let i = 0; i < musicTable.rows.length; i++) {
    
    const rowData = [];
    const cells = musicTable.rows.item(i).cells;
    
    for (let k = 0; k < cells.length; k++) {
      rowData.push(cells.item(k).innerHTML);
    } 

    tableData.push(rowData);
  }

  return tableData;
}

function saveStateToLocalStorage() {

  const state = {};
  const channelAddressInputsClassName = 'channel-address-input';
  const channelAddressInputs = document.getElementsByClassName(channelAddressInputsClassName);
  const channelAddressInputValues = [];
  let getUntilLast;
  let stateStringified;

  try {

    if (channelAddressInputs.length <= 0) {

      throw new ElementNotFoundError(channelAddressInputsClassName);
    }

    getUntilLast = generateGetUntilLast();
  
    for (let i = 0; i < channelAddressInputs.length; i++) {

      if (!(channelAddressInputs[i] instanceof HTMLInputElement)) {

        throw new ElementNotFoundError(channelAddressInputsClassName);
        return;
      }

      channelAddressInputValues.push(channelAddressInputs[i].value);
    }

    state.getUntilLast = getUntilLast;
    
    state.tableData = getTableData();
  
  } catch(e) {

    handleError(e);
    return;
  }

  state.channelAddressInputValues = channelAddressInputValues;

  try {
   
    stateStringified = JSON.stringify(state);
    localStorage.setItem('musicbox', stateStringified);
  
  } catch(e) {

    handleError(new ApplicationError('Failed to save app state'));
    return;
  }
}


function restoreStateFromLocalStorage() {

  let state;

  try {
    
    let stateStringified = localStorage.getItem('musicbox');

    if (!stateStringified) {
      return;
    }

    state = JSON.parse(stateStringified);
  
  } catch(e) {

    handleError(new ApplicationError('Failed to restore app state'));
    return;
  }


  if (!state) {
    return;
  }

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
        artist: state.tableData[i][0],
        songTitle: state.tableData[i][1],
        album: state.tableData[i][2],
        duration: state.tableData[i][3],
        publishedAt: state.tableData[i][4],
        channel: state.tableData[i][5]
      });
    }
  }

}

function getChannelIdentificator(channelAddress) {
  // identificator can be channel id or username
  const channelRoutePattern = /\/channel\/[^/\s]+/; // matches '/channel/channelId' in 'https://www.youtube.com/channel/channelId'
  const usernameRoutePattern = /\/user\/[^/\s]+/; // matches '/user/username' in 'https://www.youtube.com/user/username'
  const usernameShortRoutePattern = /.com\/[^/\s]+/; // matches '.com/username' in 'https://www.youtube.com/username'
  let identificator;

  if (channelAddress.match(channelRoutePattern)) {

    const channelIdMatches = channelAddress.match(channelRoutePattern);

    if (channelIdMatches.length !== 1) {

      new Warning(`Expected 1 match for channelRoutePattern but got ${channelIdMatches.length}.`);
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

      new Warning(`Expected 1 match for usernameRoutePattern but got ${usernameMatches.length}.`);
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

      new Warning(`Expected 1 match for usernameShortRoutePattern but got ${usernameMatches.length}.`);
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

function durationToString(duration) {
  
  let string = '';

  if (duration.hours !== null) {
    string += `${duration.hours}:`;
  }
 
  if (duration.minutes !== null) {
    string += `${duration.minutes}:`;
  } else {
    string += '00:';
  }

  if (duration.seconds !== null) {
    string += `${duration.seconds}`;
  } else {
    string += '00';
  }

  return string;
}

function parseDuration(duration) {

  const secondsPattern = /\d+(?=S)/;
  const minutesPattern = /\d+(?=M)/;
  const hoursPattern = /\d+(?=H)/;

  const secondsMatches = duration.match(secondsPattern);
  const minutesMatches = duration.match(minutesPattern);
  const hoursMatches = duration.match(hoursPattern);


  if (secondsMatches !== null && secondsMatches.length !== 1) {

    new Warning(`Expected 1 match for seconds but got ${secondsMatches.length}.`);
  }

  if (minutesMatches !== null && minutesMatches.length !== 1) {

    new Warning(`Expected 1 match for minutes but got ${minutesMatches.length}.`);
  }

  if (hoursMatches !== null && hoursMatches.length !== 1) {

    new Warning(`Expected 1 match for hours but got ${hoursMatches.length}.`);
  }

  return {
    seconds: (secondsMatches === null) ? null : secondsMatches[0],
    minutes: (minutesMatches === null) ? null : minutesMatches[0],
    hours: (hoursMatches === null) ? null : hoursMatches[0]
  };
}

async function getChannelId(username) {

  const channelResponse = await getJSONResponse(YT_CHANNELS_API, {
    key: API_KEY,
    forUsername: username,
    part: 'id'
  });

  if (
    channelResponse === null || 
    !(channelResponse.items instanceof Array) ||
    channelResponse.items.length <= 0 ||
    !(typeof channelResponse.items[0].id === 'string')) {
    
    throw new DataError('channel id');
  }

  if (channelResponse.items.length !== 1) {

    new Warning(`Expected 1 for channelResponse.items.length but got ${channelResponse.items.length}.`);
  }

  return channelResponse.items[0].id;
}

async function getChannelVideos(channelId, getUntilLast, pageToken) {
  
  const date = new Date();

  if (getUntilLast === 'week') {
    date.setDate(date.getDate() - 7);

  } else if (getUntilLast === 'month') {
    date.setMonth(date.getMonth() - 1);

  } else if (getUntilLast === 'year') {
    date.setFullYear(date.getFullYear() - 1);

  } else {
    throw new UnexpectedValueError('getUntilLast', getUntilLast);
  }

  const searchVideosResponse = await getJSONResponse(YT_SEARCH_API, {
    key: API_KEY,
    channelId: channelId,
    type: 'video',
    part: 'id',
    order: 'date',
    maxResults: SEARCH_MAX_RESULTS,
    pageToken: pageToken || '',
    publishedAfter: date.toISOString()
  });

  if (typeof searchVideosResponse !== 'object' ||
    !(searchVideosResponse.items instanceof Array)) {

    throw new DataError('videos search');
  }

  for (let i = 0; i < searchVideosResponse.items.length; i++) {

    let item = searchVideosResponse.items[i];
    resultsFound++;

    if (
      typeof item !== 'object' ||
      typeof item.id !== 'object' ||
      typeof item.id.videoId !== 'string') {

      // TODO maybe there will be a problem if we throw here
      throw new DataError('video id');
    }

    const data = await getMusicVideoData(item.id.videoId);

    if (data === null) {
      // TODO maybe there will be a problem if we throw here
      throw new DataError('music video');
    
    } else if (Object.keys(data).length === 0) {
      
      unsuccessfullyParsed++;
    } else {

      data.duration = durationToString(data.duration);

      insertTableRow(data);
    }

  }

  if (searchVideosResponse.nextPageToken) {
  
    return await getChannelVideos(channelId, getUntilLast, searchVideosResponse.nextPageToken);
  
  } else {

    return;
  }
}

function toQueryString(params) {
  const paramsList = [];

  for(const [param, val] of Object.entries(params)) {
    paramsList.push([encodeURIComponent(param), encodeURIComponent(val)]);
  }

  return paramsList.map(pair => pair.join('='))
    .join('&');
}

async function getResponse(url, queryParams) {
  return await fetch(`${url}?${toQueryString(queryParams)}`);
}

async function getJSONResponse(url, queryParams) {
  try {
    const response = await getResponse(url, queryParams);
    return await response.json();
  } catch (e) {
    return null;
  }
}

async function getMusicVideoData(videoId) {
  
  const artistPattern = /^.+(?= - )/; // matches 'Artist Name' in 'Artist Name - Song name (remix)'
  const titlePattern = / - [^\(\)\[\]]+/; // matches ' - Song name ' in 'Artist Name - Song name (remix)'
  let video;

  const videoData = await getJSONResponse(YT_VIDEOS_API, {
    key: API_KEY,
    part: 'contentDetails,snippet',
    id: videoId
  });

  if (videoData === null) {
    
    return null;
  } 

  if (
    typeof videoData !== 'object' ||
    !(videoData.items instanceof Array) ||
    videoData.items.length <= 0) {

    return null;
  }

  if (videoData.items.length !== 1) {

    new Warning(`Expected 1 for videoData items but got ${videoData.items.length}.`);
  }

  video = videoData.items[0];

  if (
    typeof video !== 'object' ||
    typeof video.snippet !== 'object' ||
    typeof video.snippet.title !== 'string' ||
    typeof video.snippet.publishedAt !== 'string' ||
    typeof video.snippet.channelTitle !== 'string' ||
    typeof video.contentDetails !== 'object' ||
    typeof video.contentDetails.duration !== 'string') {

    return null;
  }

  const videoTitle = video.snippet.title;

  const artistMatches = videoTitle.match(artistPattern);
  
  if (artistMatches === null) {

    return {};
  }

  if (artistMatches.length !== 1) {

    new Warning(`Expected 1 match for artist matches but got ${artistMatches.length}.`);
  }

  const artist = artistMatches[0].trim();

  const songTitleMatches = videoTitle.match(titlePattern);
  
  if (songTitleMatches === null) {

    return {};
  }

  if (songTitleMatches.length !== 1) {

    new Warning(`Expected 1 match for song title matches but got ${songTitleMatches.length}.`);
  }
  
  const songTitle = songTitleMatches[0].replace(' - ', '')
    .trim();

  const duration = parseDuration(video.contentDetails.duration);

  if (duration === null) {
    
    return {};
  }

  const publishedAt = video.snippet.publishedAt;
  const channel = video.snippet.channelTitle;

  return {
    artist,
    songTitle,
    duration,
    publishedAt,
    channel
  };
}

channelAddressSubmit.onclick = channelAddressSubmitOnClick;
addChannelAddressInputButton.onclick = () => addChannelAddressInput();
removeAllChannelAddressInputsButton.onclick = () => { 
  clearChannelAddressInputs();
  addChannelAddressInput();
  saveStateToLocalStorage();
};

musicTable.style.visibility = 'hidden';
searchStatus.style.visibility = 'hidden';
restoreStateFromLocalStorage();