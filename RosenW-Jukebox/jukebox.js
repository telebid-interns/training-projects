  let API_KEY = 'AIzaSyDrLczSe8MEo3k5FAwo1Kc3fkn26NB-VUQ';

  let table = document.getElementById('infoTable');
  let button = document.getElementById('subBtn');
  let timeSelect = document.getElementById('select-time');

  let channelList = [];
  let allVids = [];

  if(localStorage.getItem('channels') != null && localStorage.getItem('vids') != null){
    console.log('storage is set, getting saved data');
    channelList = JSON.parse(localStorage.getItem('channels'));
    allVids = JSON.parse(localStorage.getItem('vids'));
    showChannels();
    displayVideos();
    console.log(channelList);
    console.log(allVids);
  }else{
    console.log('storage is not set, setting storage');
    updateLocalStorage();
  }

  timeSelect.addEventListener('change', function(){
    displayVideos();
  });
  
  button.addEventListener('click', function(){
    let xhr = new XMLHttpRequest();
    let linkTextbox = document.getElementById('channel');
    let link = linkTextbox.value;
    linkTextbox.value = "";
    let channelId = link.split('/channel/')[1];
    let reqLink = 'https://www.googleapis.com/youtube/v3/search?channelId=' + channelId + '&key=' + API_KEY + '&part=snippet&type=video&maxResults=50&videoCategoryId=10';

    makeGetRequest(reqLink, function(response){
      let data = JSON.parse(response);
      let channelName = data.items[0].snippet.channelTitle;

      for(let i in channelList){
        if(channelList[i].name == channelName){
          return;
        }
      }

      channelObj = {name: channelName, url: link};
      channelList.push(channelObj);

      let videos = data.items;

      saveVideosAsObj(videos);
      updateLocalStorage();
      showChannels();
      displayVideos();
    });
  });

function saveVideosAsObj(videos){
  for(let i in videos) {
    let videoObj = {artists: [],
                    channelFoundOn: '',
                    song: '',
                    album: '',
                    duration: '',
                    date: ''};

    let artAndSong = extractArtistsAndSongFromTitle(videos[i].snippet.title); //setting song and artsts
    videoObj.channelFoundOn = videos[i].snippet.channelTitle;
    videoObj.artists = artAndSong.artists;
    videoObj.song = artAndSong.song;

    let vidDate = videos[i].snippet.publishedAt;
    videoObj.date = Date.parse(vidDate);

    if(videoObj.artists.length > 0 && videoObj.song.length > 0){ //pushing valid data to array
      allVids.push(videoObj);
    }
  }
}

function showChannels(){
  let channelsElement = document.getElementById('channels');
  channelsElement.innerHTML = "";

  for(let i in channelList){
    curChannel = channelList[i].name;
    link = channelList[i].url;

    let pElement = document.createElement("p");
    pElement.setAttribute("id", "name-" + curChannel);

    let aElement = document.createElement("a");
    aElement.setAttribute("href", link);
    aElement.appendChild(document.createTextNode(curChannel + " "));
    
    let unsubBtn = document.createElement("button");
    unsubBtn.setAttribute("id", "unsub-" + curChannel);
    unsubBtn.innerHTML = "Unsub"
    unsubBtn.addEventListener("click", function(event){
      let chName = event.target.id.substr(6,);

      channelList = channelList.filter(e => e.name !== chName);
      removeElement = document.getElementById("name-" + chName);
      removeElement.remove();
      
      allVids = allVids.filter(e => e.channelFoundOn !== chName);
      updateLocalStorage();
      displayVideos();
    });

    pElement.appendChild(aElement);
    pElement.appendChild(unsubBtn);
    channelsElement.appendChild(pElement);
  }
}

function updateLocalStorage(){
  localStorage.setItem('channels', JSON.stringify(channelList));
  localStorage.setItem('vids', JSON.stringify(allVids));
}

function getLastWeek() {
  let lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - lastWeek.getDay());
  return Date.parse(lastWeek);
}

function getLastMonth() {
  let lastMonth = new Date();
  lastMonth.setDate(1);
  lastMonth.setMonth(lastMonth.getMonth()-1);
  return Date.parse(lastMonth);
}

function getLastYear() {
  let lastYear = new Date();
  lastYear.setDate(1);
  lastYear.setYear(lastYear.getFullYear()-1);
  return Date.parse(lastYear);
}

function displayVideos(){
  cleanTable(); // use async await
  for(let i in allVids){
    if(checkFilter(allVids[i].date)){
      addVideoToTable(allVids[i]);
    }
  }
}

function checkFilter(checkDate){
  let filterElement = document.getElementById('select-time');
  let filterValue = filterElement.options[filterElement.selectedIndex].value;

  if(filterValue == 'week'){
    return checkDate - getLastWeek() > 0;
  }else if(filterValue == 'month'){
    return checkDate - getLastMonth() > 0;
  }else if(filterValue == 'year'){
    return checkDate - getLastYear() > 0;
  }else{
    return true;
  }
}

function cleanTable(){
  while (document.getElementsByTagName('tr')[1]) {
    document.getElementsByTagName('tr')[1].remove();
  }
}

function addVideoToTable(video) {
  let row = table.insertRow(-1);
  row.setAttribute('class', channel);

  let channelCell = row.insertCell(0);
  let artistCell = row.insertCell(1);
  let songCell = row.insertCell(2);

  let artistText = document.createTextNode(video.artists.join(', '));
  let songText = document.createTextNode(video.song);
  let channelText = document.createTextNode(video.channelFoundOn);

  artistCell.appendChild(artistText);
  songCell.appendChild(songText);
  channelCell.appendChild(channelText);
}

function extractArtistsAndSongFromTitle(title){
  let regex = /^([0-9a-zA-Z\s\.&']*) [-|] ([0-9a-zA-Z\s\.&"']*)/g;
  let match = regex.exec(title);
  
  let artistsAndSong = {};
  let artists = [];
  let song;


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

  if(checkOne.song != undefined) song = checkOne.song;
  if(checkTwo.song != undefined) song = checkTwo.song;
  if(checkThree.song != undefined) song = checkThree.song;
  if(checkFour.song != undefined) song = checkFour.song;

  artists = artists.filter(function(item, index) {
    if (artists.indexOf(item) == index){
      return item;
    }
  });

  song = song.replace(/"/g,"");

  return {artists: artists, song: song};
}

function checkGroupForFt(group, featString, isArtistGroup){
  let foundArtists = [];
  let song;

  if(group.includes(featString)){
    let groupTokens = group.split(featString);
    
    if(isArtistGroup){
      foundArtists.push(groupTokens[0]); //add original singer
    }else{
      song = groupTokens[0];
    }
    let feat = groupTokens[1];

    if(feat.includes(' & ')){
      let featArtists = feat.split(' & ');
      for(let i in featArtists){
        foundArtists.push(featArtists[i]);
      }
    }else{
      foundArtists.push(feat); // if feat artist is only one person whole group is the feat artist
    }
  }else if(isArtistGroup && !group.toLowerCase().includes(' ft. ')){
      foundArtists.push(group); //if there isnt a feat artist whole group is the artist
  }else{
    if(group.includes(' Feat. ')){
      song = group.split(' Feat. ')[0];
    }else if(group.includes(' ft. ')){
      song = group.split(' ft. ')[0];
    }else{
      song = group;
    }
  }

  return {artists: foundArtists, song: song};
}

function makeGetRequest(url, callback) {
  let xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function() { 
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200){
          callback(xmlHttp.responseText);
      }
  }
  xmlHttp.open("GET", url, true);
  xmlHttp.send(null);
}