function invertArray(arr) {
    return arr.map(value => {
        return arr.indexOf(value);
    }).reduce(
        (obj, index) => (obj[arr[index]] = arr),
        {}
    );
}


const TableAPI = {
    displayedChannels: [],
    columnNames: ['channel', 'artist', 'album', 'track', 'length'],
    columnIndexes: {channel: 0, artist: 1, album: 2, track: 3, length: 4},

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
                let channelName = columns[TableAPI.columnIndexes['channel']].textContent;
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

    clearTable: () => {
        document.querySelectorAll('table tbody tr')
        .forEach(row => row.remove());
    },

};

// function extractSongs(videos) {
//     let parse_map = {'liquicity': parsers.parseLiquicity()};
//     return videos.map(vid => {
//         console.log(vid.channelName);
//         let parsed = parse_map[vid.channelName.toLowerCase()](vid.title);
//         return {
//             'channel': vid.channelName,
//             'track': parsed.track,
//             'artist': parsed.artist
//         }
//     });
// }
