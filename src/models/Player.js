const playerStatus = require('../constants/playerStatus')

class Player {
  constructor (name, home) {
    this.name = name
    this.home = home
    this.status = playerStatus.LIVE

    const homeId = ['red', 'blue', 'yellow', 'green'].indexOf(home) + 1
    this.coins = {
      alfa: `${homeId}01`,
      beta: `${homeId}02`,
      charlie: `${homeId}03`,
      delta: `${homeId}04`
    }
  }
}

module.exports = Player