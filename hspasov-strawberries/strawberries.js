let k, l, r;

let goodStrawberries = 0;

// get k, l, r
k = 100;
l = 100;
r = 60;

let isRottenCurrentDay = [];
let isRottenNextDay = [];

for (let row = 0; row < k; row++) {

  isRottenCurrentDay.push(new Array(l).fill(false));
}

// get rotten strawberries
const initRottenStrawberries = [
  {
    row: 1,
    col: 1
  },
  {
    row: 100,
    col: 100
  }
];

for (let initRottenStrawberry in initRottenStrawberries) {
  isRottenCurrentDay[initRottenStrawberry.row - 1][initRottenStrawberry.col - 1] = true;
}


for (let day = 0; day < r; day++) {

}