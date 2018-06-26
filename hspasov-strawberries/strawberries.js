let k, l, r;

let goodStrawberries = 0;

// get k, l, r
k = 8;
l = 10;
r = 2;

let isRottenCurrentDay = [];
let isRottenNextDay = [];

for (let row = 0; row < k; row++) {

  isRottenCurrentDay.push(new Array(l).fill(false));
  isRottenNextDay.push(new Array(l).fill(false));
}

// get rotten strawberries
const initRottenStrawberries = [
  {
    row: 4,
    col: 8
  },
  {
    row: 2,
    col: 7
  }
];

for (let initRottenStrawberry of initRottenStrawberries) {
  isRottenCurrentDay[initRottenStrawberry.row - 1][initRottenStrawberry.col - 1] = true;
}


for (let day = 0; day < r; day++) {

  for (let row = 0; row < k; row++) {
    
    for (let col = 0; col < l; col++) {
      
      if (isRottenCurrentDay[row][col] === true) {
        
        if (row > 0) {
          isRottenNextDay[row - 1][col] = true;
        }
        if (row < k - 1) {
          isRottenNextDay[row + 1][col] = true;
        }
        if (col > 0) {
          isRottenNextDay[row][col - 1] = true;
        }
        if (col < l - 1) {
          isRottenNextDay[row][col + 1] = true;
        }
      }
    }
  }

  for (let row = 0; row < k; row++) {
    
    for (let col = 0; col < l; col++) {
      isRottenCurrentDay[row][col] = isRottenNextDay[row][col];
    }
  }
}

for (let row = 0; row < k; row++) {

  for (let col = 0; col < l; col++) {

    if (isRottenCurrentDay[row][col] === false) {
      goodStrawberries++;
    }
  }
}

console.log(goodStrawberries);