function parseInput (input) {
  const NUMBERS_ROW_PATTERN = /[\d ]+(?=\n|$)/g;
  const NUMBER_PATTERN = /\d+/g;

  const numbersRowMatched = input.match(NUMBERS_ROW_PATTERN);

  const rows = numbersRowMatched.filter((row) => {
    return row.match(NUMBER_PATTERN) !== null;
  }).map((row) => {
    return row.match(NUMBER_PATTERN).map(Number);
  });

  const [n, m] = rows[0];

  const paths = rows.filter((row, index) => {
    return index > 0;
  }).map((row) => {
    const [f, t, s] = row;

    return {
      f: String(f),
      t: String(t),
      s,
    };
  });

  return {
    m,
    n,
    paths,
  };
}

function inputToGraph (input) {
  const graph = {};

  for (let i = 1; i <= input.n; i++) {
    graph[i] = [];
  }

  for (const path of input.paths) {
    if (!graph[path.f].includes(path.t)) {
      graph[path.f].push(path.t);
    }

    if (!graph[path.t].includes(path.f)) {
      graph[path.t].push(path.f);
    }
  }

  return graph;
}

function isPathBetweenTwoPoints (graph, currentPoint, goalPoint) {
  const currentPointNeighbours = graph[currentPoint];

  if (currentPoint === goalPoint) {
    return true;
  }

  if (currentPointNeighbours.includes(goalPoint)) {
    return true;
  }

  const graphClone = { ...graph };
  delete graphClone[currentPoint];

  for (const currentPointNeighbour of currentPointNeighbours) {
    if (!graphClone[currentPointNeighbour]) {
      continue;
    }

    if (isPathBetweenTwoPoints(graphClone, currentPointNeighbour, goalPoint)) {
      return true;
    }
  }

  return false;
}


function arePathsBetweenAllPoints(graph) {
  for (const point1 in graph) {
    if (graph.hasOwnProperty(point1)) {
      for (const point2 in graph) {
        if (graph.hasOwnProperty(point2)) {
          if (!(isPathBetweenTwoPoints(graph, point1, point2))) {
            return false;
          }
        }
      }
    }
  }
  return true;
}

function getSmallest (values) {
  let smallest = values[0];

  for (const value of values) {
    if (value < smallest) {
      smallest = value;
    }
  }

  return smallest;
}

function getBiggest (values) {
  let biggest = values[0];

  for (const value of values) {
    if (value > biggest) {
      biggest = value;
    }
  }

  return biggest;
}

function filterPaths (paths, minSpeed, maxSpeed) {
  const filteredPaths = [];

  for (const path of paths) {
    if (path.s >= minSpeed && path.s <= maxSpeed) {
      filteredPaths.push(path);
    }
  }

  return filteredPaths;
}

function start () {
  const input = parseInput(`

10 17 
1 2 3 
1 2 5 
1 3 8 
  2 4 16 
  3 5 8 
  3 6 19 
  5 6 72 
  7 8 9 
  1 9 6 
  4 7 5 
  3 8 28 
  4 2 15 
  3 6 19 
  7 8 16 
  2 10 13 
  1 10 1 
  4 5 6


  `);

  const speeds = input.paths.map(p => p.s);
  const biggestSpeed = getBiggest(speeds);
  const smallestSpeed = getSmallest(speeds);
  const maxSpeedDiff = biggestSpeed - smallestSpeed;

  for (let speedDiff = 0; speedDiff <= maxSpeedDiff; speedDiff++) {
    for (let minSpeed = 0; minSpeed <= biggestSpeed - speedDiff; minSpeed++) {
      const possiblePaths = filterPaths (input.paths, minSpeed, minSpeed + speedDiff);
      const graph = inputToGraph({
        ...input,
        paths: possiblePaths,
      });

      if (arePathsBetweenAllPoints(graph)) {
        console.log(`${minSpeed} ${minSpeed + speedDiff}`);
        return;
      }
    }
  }
}

start();
