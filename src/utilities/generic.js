function fetchItemFromArrayWithKey (array = [], key = '', value) {
  let itemToBeFetched = null
  array.forEach(item => {
    if (item && item[key] && item[key] === value) {
      itemToBeFetched = item
    }
  })

  return itemToBeFetched
}

// return a random number between 1 & 6
function getDiceRollNumber () {
  return Math.round(Math.random() * 6) || 6 // to prevent chances of 0 & 6 from becoming half that of others (1 ... 5)
}

function getNextPosition (currentPosition, homeId) {
  // XYZ: quadrant ID = X; remaining: YZ
  // calculate quadrant ID & remaining
  const quadrantId = Math.floor(currentPosition / 100)
  const remaining = currentPosition % 100

  let nextPosition = 0

  if (remaining >= 10 && remaining < 15) {
    nextPosition = currentPosition + 1
  } else if (remaining === 15) {
    nextPosition = quadrantId * 100 + 25
  } else if (remaining === 25) {
    nextPosition = quadrantId * 100 + (homeId === quadrantId ? 24 : 35)
  } else if ((remaining > 20 && remaining < 25) || (remaining > 30 && remaining <= 35)) {
    nextPosition = currentPosition - 1
  } else if (remaining === 30) {
    nextPosition = (quadrantId - 1) * 100 + 10
    if (quadrantId === 1) {
      nextPosition += 400
    }
  } else if (remaining === 20) {
    nextPosition = quadrantId * 100 + 99
  }

  return nextPosition
}

function getHomeId (home) {
  return ['red', 'blue', 'yellow', 'green'].indexOf(home) + 1
}

function getCoinIndex (coinId) {
  return ['alfa', 'beta', 'charlie', 'delta'].indexOf(coinId) + 1
}

module.exports = {
  fetchItemFromArrayWithKey,
  getDiceRollNumber,
  getNextPosition,
  getHomeId,
  getCoinIndex
}
