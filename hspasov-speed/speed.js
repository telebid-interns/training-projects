function start () {
  class BaseError extends Error {}

  class AppError extends BaseError {}
  /*
  class PeerError extends BaseError {}
  */
  class UserError extends BaseError {}

  function assertApp (condition) {
    if (!condition) {
      throw new AppError();
    }
  }

  function assertUser (condition, userMessage) {
    if (!condition) {
      throw new UserError(userMessage);
    }
  }

  function isObject (param) {
    return typeof param === 'object' && param !== null;
  }

  function parseInput (input) {
    assertApp(typeof input === 'string');

    const NUMBERS_ROW_PATTERN = /[\d ]+(?=\n|$)/g;
    const NUMBER_PATTERN = /\d+/g;

    const numbersRowMatched = input.match(NUMBERS_ROW_PATTERN);

    assertUser(
      Array.isArray(numbersRowMatched),
      'Invalid input! Only digits and spaces allowed on each line of input!'
    );

    const rows = numbersRowMatched.filter((row) => {
      return row.match(NUMBER_PATTERN) !== null;
    }).map((row) => {
      return row.match(NUMBER_PATTERN).map(Number);
    });

    assertUser(
      rows.length >= 2,
      'Invalid input! Expected at least two lines! First line specifies amount of cities (N) and amount of roads (M), next lines describe each road!'
    );

    assertUser(
      rows[0].length === 2,
      'Invalid input! Expected two numbers for first line - specifying amount of cities (N) and amount of roads (M)!'
    );

    const [n, m] = rows[0];

    assertUser(
      Number.isSafeInteger(n),
      'Invalid input! Expected amount of cities (N) to be an integer!'
    );

    assertUser(
      Number.isSafeInteger(m),
      'Invalid input! Expected amount of roads (M) to be integer!'
    );

    assertUser(
      n >= 2 && n <= 1000,
      'Invalid input! Expected 2 <= N <= 1000!'
    );

    assertUser(
      m >= 1 && m <= 10000,
      'Invalid input! Expected 1 <= M <= 10000'
    );

    const paths = rows.filter((row, index) => {
      return index > 0;
    }).map((row) => {
      assertUser(
        row.length === 3,
        'Invalid input! Expected three numbers on each line after the first line!'
      );

      for (const element of row) {
        assertUser(
          Number.isSafeInteger(element),
          'Invalid input! Expected each row to have integers!'
        );
      }

      const [f, t, s] = row;

      assertUser(
        f >= 1 && f <= n,
        'Invalid input! Expected on each row 1 <= F <= N'
      );

      assertUser(
        t >= 1 && t <= n,
        'Invalid input! Expected on each row 1 <= T <= N'
      );

      assertUser(
        s >= 1 && s <= 30000,
        'Invalid input! Expected on each row 1 <= S <= 30000'
      );

      return {
        f: String(f),
        t: String(t),
        s,
      };
    });

    assertUser(
      paths.length === m,
      'Invalid input! Expected amount of rows after first line to be equal to amount of roads (M)!'
    );

    return {
      m,
      n,
      paths,
    };
  }

  function inputToGraph (input) {
    assertApp(isObject(input));
    assertApp(typeof input.n === 'number');
    assertApp(typeof input.m === 'number');
    assertApp(Array.isArray(input.paths));

    const graph = {};

    for (let i = 1; i <= input.n; i++) {
      graph[i] = [];
    }

    for (const path of input.paths) {
      assertApp(typeof path.f === 'string');
      assertApp(typeof path.t === 'string');

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
    assertApp(typeof currentPoint === 'string');
    assertApp(typeof goalPoint === 'string');

    if (currentPoint === goalPoint) {
      return true;
    }

    const currentPointNeighbours = graph[currentPoint];

    assertApp(Array.isArray(currentPointNeighbours));

    if (currentPointNeighbours.includes(goalPoint)) {
      return true;
    }

    const graphClone = {
      ...graph,
      [currentPoint]: null,
    };

    for (const currentPointNeighbour of currentPointNeighbours) {
      assertApp(typeof currentPointNeighbour === 'string');

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
    assertApp(Array.isArray(values));
    assertApp(values.length >= 1);

    let smallest = values[0];

    assertApp(typeof smallest === 'number');

    for (const value of values) {
      assertApp(typeof value === 'number');

      if (value < smallest) {
        smallest = value;
      }
    }

    return smallest;
  }

  function getBiggest (values) {
    assertApp(Array.isArray(values));
    assertApp(values.length >= 1);

    let biggest = values[0];

    assertApp(typeof biggest === 'number');

    for (const value of values) {
      assertApp(typeof value === 'number');

      if (value > biggest) {
        biggest = value;
      }
    }

    return biggest;
  }

  function filterPaths (paths, minSpeed, maxSpeed) {
    assertApp(Array.isArray(paths));
    assertApp(typeof minSpeed === 'number');
    assertApp(typeof maxSpeed === 'number');

    const filteredPaths = [];

    for (const path of paths) {
      assertApp(isObject(path));
      assertApp(typeof path.s === 'number');

      if (path.s >= minSpeed && path.s <= maxSpeed) {
        filteredPaths.push(path);
      }
    }

    return filteredPaths;
  }

  function calculate (input) {
    assertApp(isObject(input));
    assertApp(Array.isArray(input.paths));
    assertUser(
      arePathsBetweenAllPoints(inputToGraph(input)),
      'Invalid input! Expected paths between all points!'
    );

    const speeds = input.paths.map(p => p.s);
    const biggestSpeed = getBiggest(speeds);
    const smallestSpeed = getSmallest(speeds);
    const maxSpeedDiff = biggestSpeed - smallestSpeed;

    assertApp(typeof biggestSpeed === 'number');
    assertApp(typeof smallestSpeed === 'number');
    assertApp(typeof maxSpeedDiff === 'number');

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
      // console.log(biggestSpeed - speedDiff);
      for (
        let speedIndex = 0;
        sortedSpeeds[speedIndex] <= biggestSpeed - speedDiff &&
        speedIndex < sortedSpeeds.length;
        speedIndex++
      ) {
        const minSpeed = sortedSpeeds[speedIndex];
        const possiblePaths = filterPaths(
          input.paths,
          minSpeed,
          minSpeed + speedDiff
        );
        const graph = inputToGraph({
          ...input,
          paths: possiblePaths,
        });

        if (arePathsBetweenAllPoints(graph)) {
          return {
            minSpeed,
            maxSpeed: minSpeed + speedDiff,
          };
        }
      }
    }

    return null;
  }

  function displayMessage(message) {
    window.alert(message);
  }

  window.addEventListener('error', (error) => displayMessage(error.error));

  const inputElement = document.getElementById('input');
  const submitBtn = document.getElementById('submit-btn');
  const outputElement = document.getElementById('output');

  const onSubmitBtnClick = function (event) {
    assertApp(typeof inputElement.value === 'string');
    const input = parseInput(inputElement.value);
    const result = calculate(input);

    assertUser(isObject(result), 'No result found.');
    assertApp(typeof result.minSpeed === 'number');
    assertApp(typeof result.maxSpeed === 'number');

    outputElement.innerHTML = `${result.minSpeed} ${result.maxSpeed}`;
  };

  submitBtn.addEventListener('click', onSubmitBtnClick);
}

start();
