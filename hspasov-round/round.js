const submitBtn = document.getElementById('submit');
const input = document.getElementById('input');
const result = document.getElementById('result');
const canvas = document.getElementById('coordinate-system');
const GRID_SIZE = 25;
const X_AXIS_DISTANCE_GRID_LINES = 20;
const Y_AXIS_DISTANCE_GRID_LINES = 20;

function parseInput (input) {
  const NUMBERS_ROW_PATTERN = /[-\d ]+(?=\n|$)/g;
  const NUMBER_PATTERN = /-?\d+/g;

  if (typeof input !== 'string') {
    throw new Error('Invalid input. Expected string.');
  }

  const numbersRowMatched = input.match(NUMBERS_ROW_PATTERN);
  const rows = numbersRowMatched.map(row => {
    return row.match(NUMBER_PATTERN).map(Number);
  });

  if (
    rows.length <= 0 ||
    !(rows[0] instanceof Array) ||
    rows[0].length !== 1
  ) {
    throw new Error('Invalid input. Expected one number on first row.');
  }

  const n = rows[0][0];

  for (let i = 1; i < rows.length; i++) {
    if (
      !(rows[i] instanceof Array) ||
      rows[i].length !== 3
    ) {
      throw new Error('Invalid input. Expected three numbers on each row after the first one');
    }

    for (const number of rows[i]) {
      if (typeof number !== 'number') {
        throw new Error('Invalid input');
      }
    }
  }

  const circles = rows
    .filter((element, index) => index > 0)
    .map(element => ({
      x: element[0],
      y: element[1],
      r: element[2],
    }));

  return {
    n,
    circles,
  };
}

function getPaths (circles) {
  const pathsHash = {};

  for (let i = 0; i < circles.length; i++) {
    pathsHash[i + 1] = [];

    for (let k = 0; k < circles.length; k++) {
      if (k === i) {
        continue;
      }

      if (countTwoCirclesIntersections(circles[i], circles[k]) === 2) {
        pathsHash[i + 1].push(k + 1);
      }
    }
  }

  return pathsHash;
}

function calcShortestPath (pathsHash, endPoint) {
  if (Object.keys(pathsHash).length === 0 || pathsHash[1].length === 0) {
    return {
      statusCode: 1001,
      msg: 'Result: -1',
      pathLength: -1,
    };
  }

  const queue = [{
    id: 1,
    neighbours: pathsHash[1],
    pathHistory: [],
    depth: 0,
  }];
  const checked = [1];

  while (queue.length !== 0) {
    const element = queue.pop();

    for (const neighbour of element.neighbours) {
      if (neighbour === endPoint) {
        const pathLength = element.depth + 1;

        return {
          statusCode: 1000,
          msg: `Result: ${pathLength}`,
          pathHistory: [...element.pathHistory, element.id, endPoint],
          pathLength,
        };
      }

      if (!checked.includes(neighbour)) {
        queue.unshift({
          id: neighbour,
          neighbours: pathsHash[neighbour],
          pathHistory: [...element.pathHistory, element.id],
          depth: element.depth + 1,
        });
        checked.push(neighbour);
      }
    }
  }

  return {
    statusCode: 1001,
    msg: 'Result: -1',
    pathLength: -1,
  };
}

function countTwoCirclesIntersections (circle1, circle2) {
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

function drawCoordinateSys () {
  // http://usefulangle.com/post/19/html5-canvas-tutorial-how-to-draw-graphical-coordinate-system-with-grids-and-axis
  const font = '9px Arial';
  const axisLineStyle = '#000000';
  const gridLineStyle = '#e9e9e9';
  const xAxisStartingPoint = { number: 1, suffix: '' };
  const yAxisStartingPoint = { number: 1, suffix: '' };
  const ctx = canvas.getContext('2d');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const numLinesX = Math.floor(canvasHeight / GRID_SIZE);
  const numLinesY = Math.floor(canvasWidth / GRID_SIZE);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw grid lines along X-axis
  for (let i = 0; i <= numLinesX; i++) {
    ctx.beginPath();
    ctx.lineWidth = 1;

    if (i === X_AXIS_DISTANCE_GRID_LINES) {
      ctx.strokeStyle = axisLineStyle;
    } else {
      ctx.strokeStyle = gridLineStyle;
    }

    if (i === numLinesX) {
      ctx.moveTo(0, GRID_SIZE * i);
      ctx.lineTo(canvasWidth, GRID_SIZE * i);
    } else {
      ctx.moveTo(0, GRID_SIZE * i);
      ctx.lineTo(canvasWidth, GRID_SIZE * i);
    }
    ctx.stroke();
  }

  // Draw grid lines along Y-axis
  for (let i = 0; i < numLinesY; i++) {
    ctx.beginPath();
    ctx.lineWidth = 1;

    if (i === Y_AXIS_DISTANCE_GRID_LINES) {
      ctx.strokeStyle = axisLineStyle;
    } else {
      ctx.strokeStyle = gridLineStyle;
    }

    if (i === numLinesY) {
      ctx.moveTo(GRID_SIZE * i, 0);
      ctx.lineTo(GRID_SIZE * i, canvasHeight);
    } else {
      ctx.moveTo(GRID_SIZE * i, 0);
      ctx.lineTo(GRID_SIZE * i, canvasHeight);
    }
    ctx.stroke();
  }

  ctx.translate(
    Y_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
    X_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
  );

  // Draw tick marks along positive X-axis
  for (let i = 1; i < numLinesY - Y_AXIS_DISTANCE_GRID_LINES; i++) {
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = axisLineStyle;

    ctx.moveTo(GRID_SIZE * i, -3);
    ctx.lineTo(GRID_SIZE * i, 3);
    ctx.stroke();

    ctx.font = font;
    ctx.textAlign = 'start';
    ctx.fillText(
      xAxisStartingPoint.number * i + xAxisStartingPoint.suffix,
      GRID_SIZE * i - 2,
      15,
    );
  }

  // Draw tick marks along negative X-axis
  for (let i = 1; i < Y_AXIS_DISTANCE_GRID_LINES; i++) {
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = axisLineStyle;

    ctx.moveTo(-GRID_SIZE * i, -3);
    ctx.lineTo(-GRID_SIZE * i, 3);
    ctx.stroke();

    ctx.font = font;
    ctx.textAlign = 'end';
    ctx.fillText(
      -xAxisStartingPoint.number * i + xAxisStartingPoint.suffix,
      -GRID_SIZE * i + 3,
      15,
    );
  }

  // Draw tick marks along positive Y-axis
  for (let i = 1; i < numLinesX - X_AXIS_DISTANCE_GRID_LINES; i++) {
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = axisLineStyle;

    ctx.moveTo(-3, GRID_SIZE * i);
    ctx.lineTo(3, GRID_SIZE * i);
    ctx.stroke();

    ctx.font = font;
    ctx.textAlign = 'start';
    ctx.fillText(
      -yAxisStartingPoint.number * i + yAxisStartingPoint.suffix,
      8,
      GRID_SIZE * i + 3,
    );
  }

  // Draw tick marks along negative Y-axis
  for (let i = 1; i < X_AXIS_DISTANCE_GRID_LINES; i++) {
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = axisLineStyle;

    ctx.moveTo(-3, -GRID_SIZE * i);
    ctx.lineTo(3, -GRID_SIZE * i);
    ctx.stroke();

    ctx.font = font;
    ctx.textAlign = 'start';
    ctx.fillText(yAxisStartingPoint.number * i + yAxisStartingPoint.suffix,
      8,
      -GRID_SIZE * i + 3,
    );
  }

  ctx.translate(
    -Y_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
    -X_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
  );
}

function drawCircle (circle, label) {
  const ctx = canvas.getContext('2d');

  ctx.translate(
    Y_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
    X_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
  );

  drawPoint(circle.x, circle.y);

  const c = new Path2D();
  c.arc(
    circle.x * GRID_SIZE,
    circle.y * -GRID_SIZE,
    circle.r * GRID_SIZE,
    0,
    2 * Math.PI,
  );
  ctx.stroke(c);

  ctx.fillText(label, circle.x * GRID_SIZE, circle.y * -GRID_SIZE);

  ctx.translate(
    -Y_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
    -X_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
  );
}

function drawPoint (x, y) {
  const ctx = canvas.getContext('2d');

  const c = new Path2D();
  c.rect(x * GRID_SIZE, y * -GRID_SIZE, 1, 1);

  ctx.stroke(c);
}

function drawLine (point1, point2) {
  const ctx = canvas.getContext('2d');
  const pathStyle = '#FF0000';

  ctx.translate(
    Y_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
    X_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
  );

  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = pathStyle;

  ctx.moveTo(point1.x * GRID_SIZE, point1.y * -GRID_SIZE);
  ctx.lineTo(point2.x * GRID_SIZE, point2.y * -GRID_SIZE);
  ctx.stroke();

  ctx.translate(
    -Y_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
    -X_AXIS_DISTANCE_GRID_LINES * GRID_SIZE,
  );
}

function onSubmit () {
  drawCoordinateSys();

  const parsedInput = parseInput(input.value);

  const n = parsedInput.n;
  const circles = parsedInput.circles;

  if (n < 2 || n > 1000) {
    return {
      statusCode: 2000,
      msg: `n must be >= 2 and <= 1000, but n=${n}`,
    };
  }

  for (const circle of circles) {
    if (circle.x <= -10000 || circle.x >= 10000) {
      return {
        statusCode: 2001,
        msg: `x must be > -10000 and < 10000, but x=${circle.x}`,
      };
    }

    if (circle.y <= -10000 || circle.y >= 10000) {
      return {
        statusCode: 2002,
        msg: `y must be > -10000 and < 10000, but y=${circle.y}`,
      };
    }

    if (circle.r <= 0 || circle.r >= 10000) {
      return {
        statusCode: 2003,
        msg: `r must be > 0 and < 10000, but r=${circle.r}`,
      };
    }
  }

  for (let i = 0; i < circles.length; i++) {
    drawCircle(circles[i], `A${i + 1}`);
  }

  const pathsHash = getPaths(circles);
  const shortestPath = calcShortestPath(pathsHash, n);

  const shortestPathNodesFilter = (circle, index) => {
    return shortestPath.pathHistory.includes(index + 1);
  };

  const shortestPathNodes = circles.filter(shortestPathNodesFilter);

  for (let i = 0; i < shortestPathNodes.length - 1; i++) {
    const point1 = {
      x: shortestPathNodes[i].x,
      y: shortestPathNodes[i].y,
    };
    const point2 = {
      x: shortestPathNodes[i + 1].x,
      y: shortestPathNodes[i + 1].y,
    };
    drawLine(point1, point2);
  }

  result.innerHTML = shortestPath.msg;
}

submitBtn.addEventListener('click', onSubmit);
