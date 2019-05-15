const Player = require('./Player')
const matchStatus = require('../constants/matchStatus')
const { getDiceRollNumber, getHomeId, getCoinIndex } = require('../utilities/generic')

/*
 * Private members
 */

let cells = {}
const players = {} // list of all players in this match
let _didEatEnemyCoin = false // becomes true if the player just ate an enemy coin
let _coinJustReachedEnd = false // becomes true if a coin just reached end
let _noSelectionPossible = false // becomes true if the player can not select any of their coins after rolling dice
// let _hostPlayerId = ''

/*
 * Class & Public methods
 */

class Match {
  constructor () {
    this.turns = [] // list of player IDs in order of their turn (red -> blue -> yellow -> green)
    this.currentTurn = 0
    this.status = matchStatus.PREMATCH
    this.lastRoll = 0 // value of previous dice roll; roll = spaces by which a coin will move
    this.isDiceRolled = false // whether or not current player already rolled the dice; prevents multiple dice rolls
  }

  getAllPlayers () {
    return players
  }

  // cell ID in which coin currently exists
  getCoinPosition (playerId, coinId) {
    return players[playerId].coins[coinId]
  }

  // home position of coin; eg: red alfa = 101, green charlie = 403
  getCoinHomePosition (playerId, coinId) {
    return _getCoinHomePosition(playerId, coinId)
  }

  setNoSelectionPossible () {
    _noSelectionPossible = true
  }

  // check if player exists in match; return true if player ID ('id') is found in 'turns'
  checkForPlayer (id) {
    return this.turns.indexOf(id) >= 0
  }

  // declare GAME OVER if current player has all coins at X99
  isGameOver () {
    const completedCoins = players[this.currentTurn].getCompletedCoins()
    return completedCoins.length === 4
  }

  // add new player to match
  addPlayer (id, name, home) {
    // create entry for player in 'players' list
    players[id] = new Player(name, home)
    console.log('new player added ---')
    console.log(players[id])

    this.updateTurns(id, home)
  }

  // add new player to 'turns'
  updateTurns (id, home) {
    // update turns according to 'home'
    const homeId = getHomeId(home)
    let i = 0
    while (i < this.turns.length) {
      const player = players[this.turns[i]]
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
    // continue turn for same player if they just ate an enemy coin
    if (_didEatEnemyCoin) {
      _didEatEnemyCoin = false // reset flag
      return this.currentTurn
    }

    // continue turn for same player if their coin just reached its end
    if (_coinJustReachedEnd) {
      _coinJustReachedEnd = false
      return this.currentTurn
    }

    // continue turn for same player if they rolled a 6, and at least one possible coin could be selected
    if (this.lastRoll === 6 && !_noSelectionPossible) {
      return this.currentTurn
    }

    // reset _noSelectionPossible flag to false
    if (_noSelectionPossible) {
      _noSelectionPossible = false
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
    return players[playerId].getCoinPath(coinId, this.lastRoll)
  }

  playerMovesCoin (playerId, coinId, moves) {
    if (!moves.length) {
      console.warn('WARNING: No moves found')
      return
    }

    // fetch current position of coin
    const currentPosition = players[playerId].getCoinPosition(coinId)

    // remove coin from above position in 'coinPositions'
    _removeCoinFromCell(currentPosition, playerId, coinId)

    // calculate new position
    const newPosition = moves.slice(-1)[0]

    // add coin to new position
    _addCoinToCell(newPosition, playerId, coinId)

    console.log('cells', cells)

    players[playerId].updateCoinPosition(coinId, newPosition)
  }

  coinReachedEnd (playerId, coinId) {
    _coinJustReachedEnd = true
    players[playerId].coinReachedEnd(coinId)
  }

  // try to eat enemy coin if not on a safe cell; if eaten, return coin details
  didEatEnemyCoin (position, playerId, coinId) {
    if (_isOnSafeCell(position)) {
      return null
    }

    // check if enemy coin exists
    const enemyCoin = _detectEnemyCoin(position, playerId, coinId)
    if (enemyCoin) {
      // remove enemy coin
      _eatEnemyCoin(enemyCoin, position)

      // update enemy coin's position
      const { playerId, coinId } = enemyCoin
      players[playerId].updateCoinPosition(coinId, _getCoinHomePosition(playerId, coinId))

      // update status
      _didEatEnemyCoin = true

      return enemyCoin
    }

    return null
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

  getPossibleSelectionsForPlayer () {
    return players[this.currentTurn].getPossibleSelections(this.lastRoll)
  }
}

/*
 * Private methods
 */

function _removeCoinFromCell (cellId, playerId, coinId) {
  if (!cells[cellId] || !cells[cellId].length) {
    return
  }

  const coinIndex = _getCoinIndexInCell(cellId, playerId, coinId)

  coinIndex > -1 && cells[cellId].splice(coinIndex, 1)
}

function _addCoinToCell (cellId, playerId, coinId) {
  if (!cells[cellId]) {
    cells[cellId] = []
  }

  const coinIndex = _getCoinIndexInCell(cellId, playerId, coinId)

  coinIndex === -1 && cells[cellId].push({
    playerId,
    coinId
  })
}

// check if enemy coins exist in given position; if so, return the first coin
function _detectEnemyCoin (cellId, playerId) {
  const enemyCoins = cells[cellId].filter(coin => coin.playerId !== playerId)
  return enemyCoins[0]
}

// move enemy coin from its current position to home position
function _eatEnemyCoin (coin, cellId) {
  console.log('enemy coin', coin, cellId)
  const { playerId, coinId } = coin
  // remove enemy coin from current position
  _removeCoinFromCell(cellId, playerId, coinId)
  // add enemy coin to home position
  const homePosition = _getCoinHomePosition(playerId, coinId)
  _addCoinToCell(homePosition, playerId, coinId)
}

function _getCoinIndexInCell (cellId, playerId, coinId) {
  let coinIndex = -1
  cells[cellId].forEach((coin, index) => {
    if (coinIndex === -1 && coin.playerId === playerId && coin.coinId === coinId) {
      coinIndex = index
    }
  })
  return coinIndex
}

function _getCoinHomePosition (playerId, coinId) {
  const home = players[playerId].getHome()
  const homeId = getHomeId(home)

  return 100 * homeId + getCoinIndex(coinId)
}

// determine if given cell is a safe one (eg: 113, 134)
function _isOnSafeCell (position) {
  return position % 100 === 13 || position % 100 === 34
}

module.exports = Match
