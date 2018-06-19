const apiKey = 'AIzaSyDe2NF-3q_aCIi1TIW0bIN44OqHQAPEc5w';
const searchMaxResults = 1;

const channelLinkInput = document.getElementById('channel-link-input');
const channelLinkSubmit = document.getElementById('channel-link-submit');

function channelLinkSubmitOnClick() {

  console.log(channelLinkInput.value);

  if (channelLinkInput.value.match(/\/channel(?=\/.+)/)) {

    const channelIdMatches = channelLinkInput.value.match(/\/channel\/[^/\s]+/);
    const result = channelIdMatches[0].replace('/channel/', '');
    
    getChannelVideos(result).then(() => {
      console.log('finished');
    }).catch(error => {
      console.log(error);
    });
  } else if (channelLinkInput.value.match(/\/user(?=\/.+)/)) {

    const usernameMatches = channelLinkInput.value.match(/\/user\/[^/\s]+/);
    const result = usernameMatches[0].replace('/user/', '');
    console.log(result);
    
    getChannelId(result).then(channelId => {
      console.log(`Here is the channel id: ${channelId}`);
      return getChannelVideos(channelId);
    }).then(() => {
      console.log('finished');
    }).catch(error => {
      console.log(error);
    });

  } else if (channelLinkInput.value.match(/.com\/[^/\s]+/)) {

    const usernameMatches = channelLinkInput.value.match(/.com\/[^/\s]+/);
    const result = usernameMatches[0].replace('.com/', '');
    console.log(result);
    
    getChannelId(result).then(channelId => {
      console.log(`Here is the channel id: ${channelId}`);
      return getChannelVideos(channelId);
    }).then(() => {
      console.log('finished');
    }).catch(error => {
      console.log(error);
    });

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
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=contentDetails,snippet&id=${videoId}`);
  const videoData = await response.json();
  console.log(videoData.items[0].snippet.title);
  console.log('consoled log video data');
  return;
}

channelLinkSubmit.onclick = channelLinkSubmitOnClick;