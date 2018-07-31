function start () {
  const n = 6;
  const k = 2;
  const weights = [26, 7, 10, 30, 5, 4];
  weights.sort();
  const minResult = weights[0];
  const weightsSum = weights.reduce((sum, goatWeight) => sum + goatWeight);

  if (k === 1) {
    console.log(weightsSum);
    return;
  }

  for (let boatSize = minResult; boatSize < weightsSum; boatSize++) {
    let boatCarry = 0;
    let trips = 0;



    if (trips <= k) {
      console.log(boatSize);
      break;
    }
  }
}

start();
