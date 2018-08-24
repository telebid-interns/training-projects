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
  const input = {
    n: 7, // amount of points
    m: 10, // amount of direct paths between points,
    paths: [
      {
        f: '1', // from
        t: '3', // to
        s: 2, // optimal speed
      },
      {
        f: '4', // from
        t: '2', // to
        s: 8, // optimal speed
      },
      {
        f: '1', // from
        t: '2', // to
        s: 11, // optimal speed
      },
      {
        f: '1', // from
        t: '4', // to
        s: 3, // optimal speed
      },
      {
        f: '1', // from
        t: '3', // to
        s: 6, // optimal speed
      },
      {
        f: '5', // from
        t: '3', // to
        s: 5, // optimal speed
      },
      {
        f: '3', // from
        t: '6', // to
        s: 9, // optimal speed
      },
      {
        f: '7', // from
        t: '6', // to
        s: 6, // optimal speed
      },
      {
        f: '5', // from
        t: '6', // to
        s: 3, // optimal speed
      },
      {
        f: '2', // from
        t: '5', // to
        s: 7, // optimal speed
      },
    ],
  };

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
