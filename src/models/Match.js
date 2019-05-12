const Player = require('./Player')
const matchStatus = require('../constants/matchStatus')

class Match {
  constructor () {
    this.players = {}
    this.turns = [] // list of player IDs in order of their turn (red -> blue -> yellow -> green)
    this.currentTurn = 0
    this.status = matchStatus.PREMATCH
    // this.hostPlayerId = ''
    // this.lastRoll = 0 // value of previous dice roll
  }

  // return true if player ID ('id') is found in 'turns'
  checkForPlayer (id) {
    return this.turns.indexOf(id) >= 0
  }

  // add new player to match
  addPlayer (id, name, home) {
    // create entry for player in 'players' list
    this.players[id] = new Player(name, home)
    console.log('new player added ---')
    console.log(this.players[id])

    this.updateTurns(id, home)
  }

  // add new player to 'turns'
  updateTurns (id, home) {
    // update turns according to 'home'
    const homeId = getHomeId(home)
    let i = 0
    while (i < this.turns.length) {
      const player = this.players[this.turns[i]]
      const playerHomeId = getHomeId(player.getHome())
      if (playerHomeId > homeId) {
        break
      }
      i++
    }
    this.turns.splice(i, 0, id)

    console.log('Turns', this.turns)

    // set current turn to be the first player in 'turns'
    this.currentTurn = this.turns[0]
  }

  // update and return next player's turn
  getNextTurn () {
    // TODO: conditions to continue turn for same player (eg: rolling a 6)

    const currentIndex = this.turns.indexOf(this.currentTurn)
    this.currentTurn = this.turns[(currentIndex + 1) % this.turns.length]

    return this.currentTurn
  }

  getCoinPath (playerId, coinId, roll) {
    return this.players[playerId].getCoinPath(coinId, roll)
  }

  playerMovesCoin (playerId, coinId, moves) {
    if (!moves.length) {
      console.warn('WARNING: No moves found')
      return
    }
    this.players[playerId].updateCoinPosition(coinId, moves.slice(-1)[0])
  }

  // check if it is playerId's turn
  checkIfPlayersTurn (playerId) {
    return playerId === this.currentTurn
  }
}

const getHomeId = home => {
  return ['red', 'blue', 'yellow', 'green'].indexOf(home) + 1
}

module.exports = Match
