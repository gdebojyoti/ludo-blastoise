const Player = require('./Player')
const matchStatus = require('../constants/matchStatus')

class Match {
  constructor () {
    this.players = {}
    this.turns = []
    this.currentTurn = 0
    this.status = matchStatus.PREMATCH
  }

  // return true if player ID ('id') is found in 'turns'
  checkForPlayer (id) {
    return this.turns.indexOf(id) >= 0
  }

  // add new player to match
  addPlayer (id, name, home) {
    this.turns.push(id)
    // create entry for player in 'players' list
    this.players[id] = new Player(name, home)
    console.log("new player added ---")
    console.log(this.players[id])
  }

  // set first turn to be first player
  setFirstTurn () {
    if (this.currentTurn === 0) {
      this.currentTurn = this.turns[0]
    }
  }

  // set next player's turn
  updateTurn () {
    const currentIndex = this.turns.indexOf(this.currentTurn)
    this.currentTurn = this.turns[(currentIndex + 1) % this.turns.length]
  }

  getCoinPath (playerId, coinId, roll) {
    return this.players[playerId].getCoinPath(coinId, roll)
  }

  playerMovesCoin (playerId, coinId, moves) {
    if (!moves.length) {
      console.warn("WARNING: No moves found")
      return
    }
    this.players[playerId].updateCoinPosition(coinId, moves.slice(-1)[0])
  }
}

module.exports = Match