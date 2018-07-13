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

  if (n < 2 || n > 1000) {
    return;
  }

  for (const circle of circles) {
    if (circle.x <= 10000) {
      return;
    }

    if (circle.y >= 10000) {
      return;
    }

    if (circle.r <= 0 || circle.r >= 10000) {
      return;
    }
  }
}

start();
