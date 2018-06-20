const TableAPI = {
    displayedChannels: [],

    addSongs: songs => {
        let tbody = document.querySelector('table tbody');
        let addedChannels = [];
        songs.forEach(song => {
            let newRow = tbody.insertRow(-1);
            for (let name of TableAPI.columnNames) {
                newRow.insertCell(-1).textContent = song[name];
                    // .appendchild(
                    //     document.createtextnode(song[name])
                    // )
            }
        });
        TableAPI.displayedChannels.push(addedChannels)
    },

    removeSongsFromChannel: name => {
        document.querySelectorAll('table tbody tr')
            .forEach(row => {
                let columns = row.getElementsByTagName('td');
                let channelName = columns[TableAPI.columnIndex('channel')].textContent;
                console.log(channelName, name);
                if (channelName === name) {
                    row.remove();
                }
            }
        );
        TableAPI.displayedChannels.splice(
            TableAPI.displayedChannels.indexOf(name),
            1
        )
    },

    columnNames: ['channel', 'artist', 'album', 'track', 'length'],

    columnIndex: columnName  => {
        return TableAPI.columnNames.indexOf(columnName)
    }

};
let TABLE_INDEX_HEADER_MAP = {
    0: 'channelName',
    1: 'artist',
    2: 'album',
    3: 'track',
    4: 'length'
};
let TABLE_HEADER_INDEX_MAP = {};
Object.keys(TABLE_INDEX_HEADER_MAP).forEach(key => {
    TABLE_HEADER_INDEX_MAP[TABLE_INDEX_HEADER_MAP[key]] = key;
});


function removeChannelFromTable(name) {
}


function clearTable() {
    document.querySelectorAll('table tbody tr')
        .forEach(row => row.remove());

}


function populateTable(songs) {
}


function channelIsAllowed(name) {
    return name in ['Liquicity'];
}

function parseLiquicityVideoTitle(videoTitle) {
    let regex = new RegExp("([^-]+) - ([^-]+)");
    let result = regex.exec(videoTitle);
    if (result) {
        return {'artist': result[1], 'track': result[2]}
    }
}


function extractSongs(videos) {
    let parse_map = {'liquicity': parseLiquicityVideoTitle};
    return videos.map(vid => {
        let parsed = parse_map[vid.channelName.toLowerCase()](vid.title);
        return {
            'channel': vid.channelName,
            'track': parsed.track,
            'artist': parsed.artist
        }
    });
}
