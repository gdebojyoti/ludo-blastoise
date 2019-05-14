const { getNextPosition } = require('../utilities/generic')
const playerStatus = require('../constants/playerStatus')

class Player {
  constructor (name, home) {
    this.name = name
    this.home = home
    this.status = playerStatus.LIVE

    const homeId = ['red', 'blue', 'yellow', 'green'].indexOf(home) + 1
    this.coins = {
      alfa: homeId * 100 + 34,
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
}

module.exports = Player
