const Player = require('./Player')
const matchStatus = require('../constants/matchStatus')
const { getDiceRollNumber, getHomeId, getCoinIndex } = require('../utilities/generic')

/*
 * Class & Public methods
 */

class Match {
  constructor (id) {
    this.turns = [] // list of player IDs in order of their turn (red -> blue -> yellow -> green)
    this.currentTurn = ''
    this.status = matchStatus.PREMATCH
    this.lastRoll = 0 // value of previous dice roll; roll = spaces by which a coin will move
    this.isDiceRolled = false // whether or not current player already rolled the dice; prevents multiple dice rolls
    this.hostId = id // ID of host player; needed to start match

    /*
     * Private members
     */

    this._cells = {}
    this._players = {} // list of all players in this match
    this._didEatEnemyCoin = false // becomes true if the player just ate an enemy coin
    this._coinJustReachedEnd = false // becomes true if a coin just reached end
    this._noSelectionPossible = false // becomes true if the player can not select any of their coins after rolling dice
    // this._hostPlayerId = ''
  }

  // get all match details (to save in DB & communicate to client)
  getDetails () {
    return {
      isDummy: true,
      turns: this.turns,
      currentTurn: this.currentTurn,
      status: this.status,
      lastRoll: this.lastRoll,
      isDiceRolled: this.isDiceRolled,
      hostId: this.hostId,
      cells: this._cells,
      players: this._players,
      didEatEnemyCoin: this._didEatEnemyCoin,
      coinJustReachedEnd: this._coinJustReachedEnd,
      noSelectionPossible: this._noSelectionPossible
    }
  }

  getHost () {
    return this.hostId
  }

  getAllPlayers () {
    return this._players
  }

  getStatus () {
    return this.status
  }
  setStatus (status) {
    this.status = status
  }

  startMatch () {
    // cannot start with < 2 players
    if (Object.keys(this._players).length < 2) {
      return false
    }
    this.setStatus(matchStatus.ONGOING)
    return true
  }

  // cell ID in which coin currently exists
  getCoinPosition (playerId, coinId) {
    return this._players[playerId].coins[coinId]
  }

  // home position of coin; eg: red alfa = 101, green charlie = 403
  getCoinHomePosition (playerId, coinId) {
    return this._getCoinHomePosition(playerId, coinId)
  }

  setNoSelectionPossible () {
    this._noSelectionPossible = true
  }

  // fetch details of player with ID
  getPlayerDetails (id) {
    return this._players[id]
  }

  // check if player exists in match; return true if player ID ('id') is found in 'turns'
  checkForPlayer (id) {
    return this.turns.indexOf(id) >= 0
  }

  // declare GAME OVER if current player has all coins at X99
  isGameOver () {
    const completedCoins = this._players[this.currentTurn].getCompletedCoins()
    return completedCoins.length === 4
  }

  // add new player to match
  addPlayer (id, name, home) {
    // create entry for player in 'this._players' list
    this._players[id] = new Player(name, home)
    console.log('new player added ---')
    console.log(this._players[id])

    this.updateTurns(id, home)
  }

  // add new player to 'turns'
  updateTurns (id, home) {
    // update turns according to 'home'
    const homeId = getHomeId(home)
    let i = 0
    while (i < this.turns.length) {
      const player = this._players[this.turns[i]]
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
    if (this._didEatEnemyCoin) {
      this._didEatEnemyCoin = false // reset flag
      return this.currentTurn
    }

    // continue turn for same player if their coin just reached its end
    if (this._coinJustReachedEnd) {
      this._coinJustReachedEnd = false
      return this.currentTurn
    }

    // continue turn for same player if they rolled a 6, and at least one possible coin could be selected
    if (this.lastRoll === 6 && !this._noSelectionPossible) {
      return this.currentTurn
    }

    // reset this._noSelectionPossible flag to false
    if (this._noSelectionPossible) {
      this._noSelectionPossible = false
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
    return this._players[playerId].getCoinPath(coinId, this.lastRoll)
  }

  playerMovesCoin (playerId, coinId, moves) {
    if (!moves.length) {
      console.warn('WARNING: No moves found')
      return
    }

    // fetch current position of coin
    const currentPosition = this._players[playerId].getCoinPosition(coinId)

    // remove coin from above position in 'coinPositions'
    this._removeCoinFromCell(currentPosition, playerId, coinId)

    // calculate new position
    const newPosition = moves.slice(-1)[0]

    // add coin to new position
    this._addCoinToCell(newPosition, playerId, coinId)

    console.log('cells', this._cells)

    this._players[playerId].updateCoinPosition(coinId, newPosition)
  }

  coinReachedEnd (playerId, coinId) {
    this._coinJustReachedEnd = true
    this._players[playerId].coinReachedEnd(coinId)
  }

  // try to eat enemy coin if not on a safe cell; if eaten, return coin details
  didEatEnemyCoin (position, playerId, coinId) {
    if (this._isOnSafeCell(position)) {
      return null
    }

    // check if enemy coin exists
    const enemyCoin = this._detectEnemyCoin(position, playerId, coinId)
    if (enemyCoin) {
      // remove enemy coin
      this._eatEnemyCoin(enemyCoin, position)

      // update enemy coin's position
      const { playerId, coinId } = enemyCoin
      this._players[playerId].updateCoinPosition(coinId, this._getCoinHomePosition(playerId, coinId))

      // update status
      this._didEatEnemyCoin = true

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
    return this._players[this.currentTurn].getPossibleSelections(this.lastRoll)
  }

  /*
   * Private methods
   */

  _removeCoinFromCell (cellId, playerId, coinId) {
    if (!this._cells[cellId] || !this._cells[cellId].length) {
      return
    }

    const coinIndex = this._getCoinIndexInCell(cellId, playerId, coinId)

    coinIndex > -1 && this._cells[cellId].splice(coinIndex, 1)
  }

  _addCoinToCell (cellId, playerId, coinId) {
    if (!this._cells[cellId]) {
      this._cells[cellId] = []
    }

    const coinIndex = this._getCoinIndexInCell(cellId, playerId, coinId)

    coinIndex === -1 && this._cells[cellId].push({
      playerId,
      coinId
    })
  }

  // check if enemy coins exist in given position; if so, return the first coin
  _detectEnemyCoin (cellId, playerId) {
    const enemyCoins = this._cells[cellId].filter(coin => coin.playerId !== playerId)
    return enemyCoins[0]
  }

  // move enemy coin from its current position to home position
  _eatEnemyCoin (coin, cellId) {
    console.log('enemy coin', coin, cellId)
    const { playerId, coinId } = coin
    // remove enemy coin from current position
    this._removeCoinFromCell(cellId, playerId, coinId)
    // add enemy coin to home position
    const homePosition = this._getCoinHomePosition(playerId, coinId)
    this._addCoinToCell(homePosition, playerId, coinId)
  }

  _getCoinIndexInCell (cellId, playerId, coinId) {
    let coinIndex = -1
    this._cells[cellId].forEach((coin, index) => {
      if (coinIndex === -1 && coin.playerId === playerId && coin.coinId === coinId) {
        coinIndex = index
      }
    })
    return coinIndex
  }

  _getCoinHomePosition (playerId, coinId) {
    const home = this._players[playerId].getHome()
    const homeId = getHomeId(home)

    return 100 * homeId + getCoinIndex(coinId)
  }

  // determine if given cell is a safe one (eg: 113, 134)
  _isOnSafeCell (position) {
    return position % 100 === 13 || position % 100 === 34
  }
}

module.exports = Match
