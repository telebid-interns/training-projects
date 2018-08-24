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

  const graphClone = {
    ...graph,
    [currentPoint]: null,
  };

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

function arePathsBetweenAllPoints (graph) {
  const graphEntries = Object.entries(graph);

  for (let i = 0; i < graphEntries.length; i++) {
    for (let k = i + 1; k < graphEntries.length; k++) {
      const [point1, paths1] = graphEntries[i];
      const [point2, paths2] = graphEntries[k];

      if (!paths1 || !paths2) {
        continue;
      }

      if (!(isPathBetweenTwoPoints(graph, point1, point2))) {
        return false;
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

  7 10
  1 3 2
  4 2 8
  1 2 11
  1 4 3
  1 3 6
  5 3 5
  3 6 9
  7 6 6
  5 6 3
  2 5 7

  `);

  const speeds = input.paths.map(p => p.s);
  const biggestSpeed = getBiggest(speeds);
  const smallestSpeed = getSmallest(speeds);
  const maxSpeedDiff = biggestSpeed - smallestSpeed;

  const sortedSpeeds = speeds.slice().sort((a, b) => { // sort ASC
    if (a > b) {
      return 1;
    } else if (a < b) {
      return -1;
    } else {
      return 0;
    }
  });

  for (let speedDiff = 0; speedDiff <= maxSpeedDiff; speedDiff++) {
    for (let speedIndex = 0; sortedSpeeds[speedIndex] <= biggestSpeed - speedDiff; speedIndex++) {
      const minSpeed = sortedSpeeds[speedIndex];
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
