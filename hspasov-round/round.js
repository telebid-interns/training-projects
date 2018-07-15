function start () {
  const n = 3;
  const circles = [
    {
      x: 0,
      y: 0,
      r: 1,
    },
    {
      x: 4,
      y: 0,
      r: 4,
    },
    {
      x: 1,
      y: 0,
      r: 2,
    },
  ];

  // const n = 7;
  // const circles = [
  //   {
  //     x: 3,
  //     y: -9,
  //     r: 4,
  //   },
  //   {
  //     x: -3,
  //     y: -5,
  //     r: 2,
  //   },
  //   {
  //     x: 0,
  //     y: 0,
  //     r: 7,
  //   },
  //   {
  //     x: 0,
  //     y: 6,
  //     r: 3,
  //   },
  //   {
  //     x: 4,
  //     y: 6,
  //     r: 3,
  //   },
  //   {
  //     x: 5,
  //     y: 7,
  //     r: 4,
  //   },
  //   {
  //     x: 8,
  //     y: 9,
  //     r: 1,
  //   },
  // ];

  if (n < 2 || n > 1000) {
    console.log(`n must be >= 2 and <= 1000, but n=${n}`);
    return;
  }

  for (const circle of circles) {
    if (circle.x <= -10000 || circle.x >= 10000) {
      console.log(`x must be > -10000 and < 10000, but x=${circle.x}`);
      return;
    }

    if (circle.y <= -10000 || circle.y >= 10000) {
      console.log(`y must be > -10000 and < 10000, but y=${circle.y}`);
      return;
    }

    if (circle.r <= 0 || circle.r >= 10000) {
      console.log(`r must be > 0 and < 10000, but x=${circle.r}`);
      return;
    }
  }

  const pathsHash = {};

  for (let i = 0; i < circles.length; i++) {
    pathsHash[i + 1] = [];
    for (let k = 0; k < circles.length; k++) {
      if (k === i) {
        continue;
      }
      // console.log(circles[i]);
      // console.log(circles[k]);
      // console.log(countCirclesIntersections(circles[i], circles[k]));
      if (countCirclesIntersections(circles[i], circles[k]) === 2) {
        pathsHash[i + 1].push(k + 1);
      }
    }
  }

  // console.log(pathsHash);

  if (Object.keys(pathsHash).length === 0 || pathsHash[1].length === 0) {
    console.log(-1);
    return;
  }

  const queue = [{
    neighbours: pathsHash[1],
    depth: 0,
  }];
  const checked = [1];

  while (queue.length !== 0) {
    const element = queue.pop();
    // console.log(element);

    for (const neighbour of element.neighbours) {
      if (neighbour === n) {
        console.log(element.depth + 1);
        return;
      }
      if (!checked.includes(neighbour)) {
        queue.unshift({
          neighbours: pathsHash[neighbour],
          depth: element.depth + 1,
        });
        checked.push(neighbour);
      }
    }
  }

  console.log(-1);
}

function countCirclesIntersections (circle1, circle2) {
  const circlesCentersDistance = calcCircleCentersDistance(circle1, circle2);
  const biggerRadius = (circle1.r >= circle2.r) ? circle1.r : circle2.r;
  const smallerRadius = (circle1.r <= circle2.r) ? circle1.r : circle2.r;

  if (
    circle1.r + circle2.r > circlesCentersDistance &&
    biggerRadius - smallerRadius < circlesCentersDistance) {
    return 2;
  } else if (
    circle1.r + circle2.r === circlesCentersDistance ||
    biggerRadius - smallerRadius === circlesCentersDistance
  ) {
    return 1;
  } else if (
    circle1.x === circle2.x &&
    circle1.y === circle2.y &&
    circle1.r === circle2.r
  ) {
    return Infinity;
  } else {
    return 0;
  }
}

function calcCircleCentersDistance (circle1, circle2) {
  let xDiff = circle1.x - circle2.x;
  let yDiff = circle1.y - circle2.y;

  if (xDiff < 0) {
    xDiff *= -1;
  }

  if (yDiff < 0) {
    yDiff *= -1;
  }

  return calcHypotenuse(xDiff, yDiff);
}

function calcHypotenuse (catethus1, catethus2) {
  return Math.sqrt((catethus1 ** 2) + (catethus2 ** 2));
}

start();
