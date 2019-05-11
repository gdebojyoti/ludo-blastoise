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

  moveCoin (coinId, roll) {
    // this.coins[coinId] += roll
    let position = this.coins[coinId]
    const moves = []
    const homeId = ['red', 'blue', 'yellow', 'green'].indexOf(this.home) + 1

    while (roll > 0) {
      // get next position
      position = getNextPosition(position, homeId)

      // add position to moves list
      moves.push(position)

      // decrease remaining roll count
      roll--
    }

    console.log("moves", moves)

    this.coins[coinId] = position
  }
}

module.exports = Player