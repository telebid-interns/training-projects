function start () {
  const n = 15;
  const k = 3;
  const weights = [666, 42, 7, 13, 400, 511, 600, 200, 202, 111, 313, 94, 280, 72, 42]; // later, the same array is sorted!!

  weights.sort((a, b) => { // desc
    if (a < b) {
      return 1;
    } else if (a > b) {
      return -1;
    } else {
      return 0;
    }
  });

  const minResult = weights[0];
  const weightsSum = weights.reduce((sum, goatWeight) => sum + goatWeight);

  if (k === 1) {
    // min boat size must be equal to the sum of the goats
    // in order to transfer all of them
    console.log(weightsSum);
    return;
  }

  for (let boatSize = minResult; boatSize < weightsSum; boatSize++) {
    let boatCarry = 0;
    let trips = 0;
    let index = 0;
    const sortedGoatsIsTransfered = [];

    for (let i = 0; i < weights.length; i++) {
      sortedGoatsIsTransfered.push(false);
    }

    while (sortedGoatsIsTransfered.findIndex(e => e === false) !== -1) {
      if (sortedGoatsIsTransfered[index]) {
        if (index === sortedGoatsIsTransfered.length - 1) {
          // at the end of the array, and current goat is transfered
          // so the boat can go across the river
          trips++;
          boatCarry = 0;

          // at the end of the array, but while loop did not finish,
          // so there must still be a goat that is not transfered at previous index

          index = 0;
        } else {
          // not at the end of the array,
          // goat is transfered,
          // nothing else to do except check next array element

          index++;
        }
      } else {
        if (boatCarry + weights[index] <= boatSize) {
          // goat not transfered,
          // goat's weight allows the goat to be on boat
          // so adding goat to boat, marking goat as transfered
          boatCarry += weights[index];
          sortedGoatsIsTransfered[index] = true;
        } else {
          // console.log('boatCarry: ', boatCarry);
          // console.log('weights[index]: ', weights[index]);
          // console.log('boatSize: ', boatSize);
        }

        if (
          // if at the end of the array
          index === sortedGoatsIsTransfered.length - 1 ||
          // or if not at the end, but all goats are either transfered or on the boat
          sortedGoatsIsTransfered.findIndex(e => e === false) === -1
        ) {
          // the boat can go across the river
          trips++;
          boatCarry = 0;

          // setting index to 0, because at the end of the array or
          // with all goats transfered there is nothing to do at higher indexes.
          // On the next iteration of the while loop,
          // the program will either keep checking for more goats to transfer, or exit the loop
          index = 0;
        } else {
          // not at the end of the array and there are more goats to transfer:
          // check the next elements in the array.
          // If among them there are goats that can be transfered, they will be transfered,
          // otherwise the program will enter the if part of this logical construction and
          // index will be reset to 0 in order to check the goats that are at lower index
          index++;
        }
      }
    }

    if (trips <= k) {
      console.log(boatSize);
      break;
    }
  }
}

start();
