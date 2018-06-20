const apiKey = 'AIzaSyDe2NF-3q_aCIi1TIW0bIN44OqHQAPEc5w';
const searchMaxResults = 50;

const channelLinkSubmit = document.getElementById('channel-link-submit');
const addChannelLinkInput = document.getElementById('add-channel-link-input');
const musicTable = document.getElementById('music-table');

function channelLinkSubmitOnClick() {
  clearTable();

  const channelLinkInputs = document.getElementsByName('channel-link-input');
  const getUntilLastElements = document.getElementsByName('getUntilLast');

  let getUntilLast;
  for (let i = 0; i < getUntilLastElements.length; i++) {
    
    if (getUntilLastElements[i].checked) {
      
      getUntilLast = getUntilLastElements[i].value
      break;
    }

  }
  
  channelLinkInputs.forEach(async input => {
    const { type, value } = getChannelIdentificator(input.value);

    let channelId;
  
    if (type === 'username') {
      channelId = await getChannelId(value);
    } else if (type === 'channelId') {
      channelId = value;
    } else {
      // error
      return;
    }
  
    await getChannelVideos(channelId, getUntilLast);
    console.log(channelId);
  });
}

function addChannelLinkInputOnClick() {
  const channelLinkInputs = document.getElementById("channel-link-inputs");
  const newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.className = 'form-control';
  newInput.placeholder = 'Link to channel';
  newInput.name = 'channel-link-input';
  channelLinkInputs.appendChild(newInput);
}

function clearTable() {
  let tableHeaderRowCount = 1;
  
  for (let i = musicTable.rows.length - 1; i >= tableHeaderRowCount; i--) {
    musicTable.deleteRow(i);
  }
}

function insertTableRow(data) {
  console.log(data);
  let newRow = musicTable.insertRow(musicTable.rows.length);
  let artistCell = newRow.insertCell(0);
  let songCell = newRow.insertCell(1);
  let albumCell = newRow.insertCell(2);
  let durationCell = newRow.insertCell(3);
  let releasedCell = newRow.insertCell(4);
  
  artistCell.innerHTML = data.artist;
  songCell.innerHTML = data.songTitle;
  albumCell.innerHTML = "";
  durationCell.innerHTML = durationToString(data.duration);
  releasedCell.innerHTML = data.publishedAt;
}

function getChannelIdentificator(channelAddress) {
  // identificator can be channel id or username
  const channelRoutePattern = /\/channel\/[^/\s]+/; // matches '/channel/channelId' in 'https://www.youtube.com/channel/channelId'
  const usernameRoutePattern = /\/user\/[^/\s]+/; // matches '/user/username' in 'https://www.youtube.com/user/username'
  const usernameShortRoutePattern = /.com\/[^/\s]+/; // matches '.com/username' in 'https://www.youtube.com/username'

  if (channelAddress.match(channelRoutePattern)) {

    const channelIdMatches = channelAddress.match(channelRoutePattern);
    const result = channelIdMatches[0].replace('/channel/', '').trim();
    
    return {
      type: 'channelId',
      value: result
    };

  } else if (channelAddress.match(usernameRoutePattern)) {

    const usernameMatches = channelAddress.match(usernameRoutePattern);
    const result = usernameMatches[0].replace('/user/', '').trim();
    
    return {
      type: 'username',
      value: result
    };

  } else if (channelAddress.match(usernameShortRoutePattern)) {

    const usernameMatches = channelAddress.match(usernameShortRoutePattern);
    const result = usernameMatches[0].replace('.com/', '').trim();

    return {
      type: 'username',
      value: result
    };

  } else {
    // error - invalid input
  }
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

  return {
    seconds: (secondsMatches === null) ? null : secondsMatches[0],
    minutes: (minutesMatches === null) ? null : minutesMatches[0],
    hours: (hoursMatches === null) ? null : hoursMatches[0]
  };
}

async function getChannelId(username) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${apiKey}&forUsername=${username}&part=id`);
  const channelResponse = await response.json();
  return channelResponse.items[0].id;
}

async function getChannelVideos(channelId, getUntilLast, pageToken='') {
  
  const date = new Date();
  switch (getUntilLast) {
    case 'week':
      date.setDate(date.getDate() - 7);
      break;
    case 'month':
      date.setMonth(date.getMonth() - 1);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() - 1);
      break;
    default:
      // error
  }

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&type=video&part=id&order=date&maxResults=${searchMaxResults}&pageToken=${pageToken}&publishedAfter=${date.toISOString()}`);
  const searchVideosResponse = await response.json();
  await Promise.all(searchVideosResponse.items.map(async item => {
    const data = await getMusicVideoData(item.id.videoId);
    if (data !== null) {
      insertTableRow(data);
    }
  }));

  if (searchVideosResponse.nextPageToken) {
    return await getChannelVideos(channelId, getUntilLast, searchVideosResponse.nextPageToken);
  } else {
    return;
  }
}

async function getMusicVideoData(videoId) {
  const artistPattern = /^.+(?= - )/; // matches 'Artist Name' in 'Artist Name - Song name (remix)'
  const titlePattern = / - [^\(\)\[\]]+/; // matches ' - Song name ' in 'Artist Name - Song name (remix)'

  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=contentDetails,snippet&id=${videoId}`);
  const videoData = await response.json();

  const videoTitle = videoData.items[0].snippet.title;

  const artistMatches = videoTitle.match(artistPattern);
  if (artistMatches === null) {
    return null;
  }
  const artist = artistMatches[0].trim();

  const songTitleMatches = videoTitle.match(titlePattern);
  if (songTitleMatches === null) {
    return null;
  }
  const songTitle = songTitleMatches[0].replace(' - ', '').trim();

  const duration = parseDuration(videoData.items[0].contentDetails.duration);

  const publishedAt = videoData.items[0].snippet.publishedAt;

  return {
    artist,
    songTitle,
    duration,
    publishedAt
  };
}

channelLinkSubmit.onclick = channelLinkSubmitOnClick;
addChannelLinkInput.onclick = addChannelLinkInputOnClick;
