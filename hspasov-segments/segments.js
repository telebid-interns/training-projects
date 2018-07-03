const n = 20;
const a = 2;
const b = 5;
const c = 2;

const points = new Array(n + 1);
const redPaths = new Array(n);

points.fill(false);
redPaths.fill(false);

for (let i = 0; i < points.length; i++) {
  if (i % a === 0) {
    points[i] = true;
  }

  if (i % b == 0) {
    points[points.length - i - 1] = true;
  }
}

let beginning = 0;
for (let i = 1; i < points.length; i++) {
  if (points[i]) {
    if (i - beginning === c) {
      redPaths.fill(true, beginning, i);
    }
    beginning = i;
  }
}

// console.log(points);
// console.log(redPaths);

let result = 0;

for (let i = 0; i < redPaths.length; i++) {
  if (!redPaths[i]) result++;
}

console.log(result);
