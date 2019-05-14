const Player = require('./Player')
const matchStatus = require('../constants/matchStatus')
const { getDiceRollNumber } = require('../utilities/generic')

let cells = {}

class Match {
  constructor () {
    this.players = {}
    this.turns = [] // list of player IDs in order of their turn (red -> blue -> yellow -> green)
    this.currentTurn = 0
    this.status = matchStatus.PREMATCH
    this.lastRoll = 0 // value of previous dice roll; roll = spaces by which a coin will move
    this.isDiceRolled = false // whether or not current player already rolled the dice; prevents multiple dice rolls
    // this.hostPlayerId = ''
  }

  // check if player exists in match; return true if player ID ('id') is found in 'turns'
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
    // continue turn for same player if they rolled a 6
    if (this.lastRoll === 6) {
      return this.currentTurn
    }

    const currentIndex = this.turns.indexOf(this.currentTurn)
    this.currentTurn = this.turns[(currentIndex + 1) % this.turns.length]

    return this.currentTurn
  }

  getDiceRollNumber (number) {
    this.lastRoll = number || getDiceRollNumber()
    return this.lastRoll
  }

  getCoinPath (playerId, coinId) {
    return this.players[playerId].getCoinPath(coinId, this.lastRoll)
  }

  playerMovesCoin (playerId, coinId, moves) {
    if (!moves.length) {
      console.warn('WARNING: No moves found')
      return
    }

    // fetch current position of coin
    const currentPosition = this.players[playerId].getCoinPosition(coinId)

    // remove coin from above position in 'coinPositions'
    removeCoinFromCell(currentPosition, playerId, coinId)

    // calculate new position
    const newPosition = moves.slice(-1)[0]

    // add coin to new position
    addCoinToCell(newPosition, playerId, coinId)

    console.log('cells', cells)

    this.players[playerId].updateCoinPosition(coinId, newPosition)
  }

  // check if it is playerId's turn
  checkIfPlayersTurn (playerId) {
    return playerId === this.currentTurn
  }

  // check if current player has already rolled the dice
  hasAlreadyRolled () {
    return this.isDiceRolled
  }

  // update dice rolled status
  setDiceRolled (state) {
    this.isDiceRolled = state
  }
}

function getHomeId (home) {
  return ['red', 'blue', 'yellow', 'green'].indexOf(home) + 1
}

function removeCoinFromCell (cellId, playerId, coinId) {
  if (!cells[cellId] || !cells[cellId].length) {
    return
  }

  const coinIndex = getCoinIndexInCell(cellId, playerId, coinId)

  coinIndex > -1 && cells[cellId].splice(coinIndex, 1)
}

function addCoinToCell (cellId, playerId, coinId) {
  if (!cells[cellId]) {
    cells[cellId] = []
  }

  const coinIndex = getCoinIndexInCell(cellId, playerId, coinId)

  coinIndex === -1 && cells[cellId].push({
    playerId,
    coinId
  })
}

function getCoinIndexInCell (cellId, playerId, coinId) {
  let coinIndex = -1
  cells[cellId].forEach((coin, index) => {
    if (coinIndex === -1 && coin.playerId === playerId && coin.coinId === coinId) {
      coinIndex = index
    }
  })
  return coinIndex
}

module.exports = Match
