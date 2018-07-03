function assert(assertion, errMsg) {
  if (!assertion) {
    console.error(errMsg);
  }
}

const n = 20;
const a = 3;
const b = 2;
const c = 1;

assert(
  Number.isInteger(n) &&
  Number.isInteger(a) &&
  Number.isInteger(b) &&
  Number.isInteger(c) &&
  n > 0 &&
  a > 0 &&
  b > 0 &&
  c > 0 &&
  n < 100000 &&
  a < 100000 &&
  b < 100000 &&
  c < 100000,
  'Invalid input.'
);

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

for (let i = 0; i < points.length - c; i++) {
  if (points[i] && points[i + c]) {
    redPaths.fill(true, i, i + c);
  }
}

// console.log(points);
// console.log(redPaths);

let result = 0;

for (let i = 0; i < redPaths.length; i++) {
  if (!redPaths[i])  {
    result++;
  }
}

console.log(result);
