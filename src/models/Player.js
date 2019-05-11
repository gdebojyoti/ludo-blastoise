const playerStatus = require('../constants/playerStatus')

class Player {
  constructor (name, home) {
    this.name = name
    this.home = home
    this.status = playerStatus.LIVE

    const homeId = ['red', 'blue', 'yellow', 'green'].indexOf(home) + 1
    this.coins = {
      alfa: homeId * 100 + 1,
      beta: homeId * 100 + 2,
      charlie: homeId * 100 + 3,
      delta: homeId * 100 + 4
    }
  }

  moveCoin (coinId, roll) {
    this.coins[coinId] += roll
  }
}

module.exports = Player