const apiKey = 'AIzaSyDe2NF-3q_aCIi1TIW0bIN44OqHQAPEc5w';
const searchMaxResults = 1;

const channelLinkSubmit = document.getElementById('channel-link-submit');

function channelLinkSubmitOnClick() {
  const channelLinkInput = document.getElementById('channel-link-input');
  const channelLinkInput2 = document.getElementById('channel-link-input2');

  const channelLinks = [channelLinkInput.value, channelLinkInput2.value];
  
  channelLinks.forEach(async link => {
    const { type, value } = getChannelIdentificator(link);

    let channelId;
  
    if (type === 'username') {
      channelId = await getChannelId(value);
    } else if (type === 'channelId') {
      channelId = value;
    } else {
      // error
      return;
    }
  
    await getChannelVideos(channelId);
  });

  console.log('finished');
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

async function getChannelId(username) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${apiKey}&forUsername=${username}&part=id`);
  const ytChannelResponse = await response.json();
  console.log(ytChannelResponse);
  return ytChannelResponse.items[0].id;
}

async function getChannelVideos(channelId, pagesLeft=20, pageToken='') {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&type=video&part=id&order=date&maxResults=${searchMaxResults}&pageToken=${pageToken}`);
  const ytSearchVideosResponse = await response.json();
  await Promise.all(ytSearchVideosResponse.items.map(item => getVideoData(item.id.videoId)));
  if (pagesLeft > 0 && ytSearchVideosResponse.nextPageToken) {
    return await getChannelVideos(channelId, pagesLeft - 1, ytSearchVideosResponse.nextPageToken);
  } else {
    return;
  }
}

async function getVideoData(videoId) {
  const artistPattern = /^.+(?= - )/; // matches 'Artist Name' in 'Artist Name - Song name (remix)'
  const titlePattern = / - [^\(\)\[\]]+/; // matches ' - Song name ' in 'Artist Name - Song name (remix)'

  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=contentDetails,snippet&id=${videoId}`);
  const videoData = await response.json();

  const videoTitle = videoData.items[0].snippet.title;
  
  const artistMatches = videoTitle.match(artistPattern);
  const artist = artistMatches[0].trim();

  const songTitleMatches = videoTitle.match(titlePattern);
  const songTitle = songTitleMatches[0].replace(' - ', '').trim();

  console.log(artist);
  console.log(songTitle);
  return { artist, songTitle };
}

channelLinkSubmit.onclick = channelLinkSubmitOnClick;
