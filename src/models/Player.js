const { getNextPosition, getHomeId } = require('../utilities/generic')
const playerStatus = require('../constants/playerStatus')

const _completedCoins = [] // coins that have reached the end

class Player {
  constructor (name, home) {
    this.name = name
    this.home = home
    this.status = playerStatus.LIVE

    const homeId = getHomeId(home)
    this.coins = {
      alfa: homeId * 100 + 1,
      beta: homeId * 100 + 2,
      charlie: homeId * 100 + 3,
      delta: homeId * 100 + 4
    }
  }

  getName () {
    return this.name
  }

  getHome () {
    return this.home
  }

  getDetails () {
    return {
      name: this.name,
      home: this.home,
      status: this.status
    }
  }

  getCoinPosition (coinId) {
    return this.coins[coinId]
  }

  // list of positions that a coin will pass through to complete its move
  getCoinPath (coinId, roll) {
    let position = this.coins[coinId]
    const moves = []
    const homeId = ['red', 'blue', 'yellow', 'green'].indexOf(this.home) + 1

    // handle 6 for coins at home
    if (roll === 6) {
      const cellIdPart = position % 100
      if (cellIdPart <= 4) {
        return [position - cellIdPart + 34]
      }
    }

    while (roll > 0) {
      // get immediate next position of coin
      position = getNextPosition(position, homeId)

      // path is invalid if next position is 0 (i.e. cases when 'roll' value is too high)
      if (!position) {
        return []
      }

      // add position to moves list
      moves.push(position)

      // decrease remaining roll count
      roll--
    }

    return moves
  }

  updateCoinPosition (coinId, position) {
    this.coins[coinId] = position
  }

  coinReachedEnd (coinId) {
    _completedCoins.indexOf(coinId) === -1 && _completedCoins.push(coinId)
  }

  getCompletedCoins () {
    return _completedCoins
  }

  getPossibleSelections (roll) {
    const choices = []
    // get all positions of current player's coins
    for (const coin in this.coins) {
      _canCoinBeSelected(this.coins[coin], roll) && choices.push(coin)
    }
    return choices
  }
}

// can a particular coin (position) be selected for given dice roll
function _canCoinBeSelected (position, roll) {
  return !_isCoinStuckAtHome(position, roll) && !_isCoinFinished(position) && !_isCoinStuckNearEnd(position, roll)
}

// is coin at home cell (X01 ~ X04)
function _isCoinStuckAtHome (position, roll) {
  const rem = position % 100
  return rem >= 1 && rem <= 4 && roll !== 6
}

// has coin reached the end (X99)
function _isCoinFinished (position) {
  return position % 100 === 99
}

// check if stuck near the end (X20 ~ X25)
function _isCoinStuckNearEnd (position, roll) {
  const rem = position % 100
  if (rem < 20 || rem > 25) {
    return false
  }

  // check if rolled number is low enough
  if (rem - roll > 18) {
    return false
  }

  return true
}

module.exports = Player
