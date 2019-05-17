let io

module.exports = function (server) {
  io = require('socket.io')(server)
  io.on('connection', _onConnection)
}

const Match = require('../models/Match')

const matches = []
const matchId = 'M31291' // some random match ID

matches[matchId] = new Match()

function _onConnection (client) {
  // console.log('new connection...', client.id)
  const match = matches[matchId]
  let playerId = 'noid'
  let playerName = 'noname'

  // add client to room (room = match; uniquely identified by match ID)
  client.join(matchId)

  // when a new player joins, inform everyone
  client.on('JOIN_MATCH', ({ name, home }) => {
    // TODO: name is being used as player ID for now; rectify this; playerId should be unique
    playerId = name // ID of current player (client)
    playerName = name
    if (!name) {
      return
    }

    // if player already exists in current match
    if (match.checkForPlayer(playerId)) {
      // send all latest match data to player
      client.emit('LATEST_MATCH_DATA', {
        playerId,
        players: match.getAllPlayers(),
        matchId,
        name,
        home
      })

      // exit
      return
    }

    // add player to current match
    match.addPlayer(playerId, name, home)

    console.log(playerId, 'has joined', home)

    // send all latest match data to player
    client.emit('LATEST_MATCH_DATA', {
      playerId,
      players: match.getAllPlayers(),
      matchId,
      name,
      home
    })

    // send new joinee details to others
    client.to(matchId).emit('PLAYER_JOINED', {
      matchId,
      id: playerId,
      name,
      home
    })
  })

  // when client requests to roll dice
  client.on('TRIGGER_DICE_ROLL', (number) => {
    // exit if it is not client's turn
    if (!match.checkIfPlayersTurn(playerId)) {
      return
    }

    // exit if client has already rolled dice
    if (match.hasAlreadyRolled()) {
      return
    }

    io.in(matchId).emit('DICE_ROLLED', {
      playerId,
      name: playerName,
      roll: match.getDiceRollNumber(number)
    })

    // trigger dice rolled status; stops client from rolling again and again
    match.setDiceRolled(true)

    // check if any possible coin selections exist for current player
    const choices = match.getPossibleSelectionsForPlayer()
    console.log('choices / selections', choices)
    // if not, trigger next turn
    if (!choices.length) {
      // reset dice rolled status to false (allow dice to be rolled again)
      match.setDiceRolled(false)

      // set no selection possible
      match.setNoSelectionPossible()

      io.in(matchId).emit('SET_NEXT_TURN', {
        playerId: match.getNextTurn()
      })
    }
  })

  // when client selects the coin they want to move
  client.on('COIN_SELECTED', ({ coinId }) => {
    // exit if it is not client's turn
    if (!match.checkIfPlayersTurn(playerId)) {
      return
    }

    const coinPath = match.getCoinPath(playerId, coinId)

    // choice of coin is invalid if moves count = 0
    if (!coinPath.length) {
      return
    }

    match.playerMovesCoin(playerId, coinId, coinPath)

    const coinPosition = match.getCoinPosition(playerId, coinId)
    io.in(matchId).emit('COIN_POSITION_UPDATED', {
      playerId,
      coinId,
      coinPosition,
      coinPath
    })

    // check if enemy coin was eaten
    const enemyCoinEaten = match.didEatEnemyCoin(coinPosition, playerId, coinId)
    if (enemyCoinEaten) {
      const { playerId, coinId } = enemyCoinEaten
      io.in(matchId).emit('ENEMY_COIN_EATEN', {
        coin: enemyCoinEaten,
        position: match.getCoinHomePosition(playerId, coinId),
        coinPositionOld: coinPosition
      })
    }

    // check if coin has reached the end; i.e. cell ID is X99 (X = quadrant ID)
    if (coinPosition % 100 === 99) {
      // update player's completedCoins
      match.coinReachedEnd(playerId, coinId)
      // let everyone know
      io.in(matchId).emit('COIN_REACHED_END', {
        playerId,
        coinId
      })
    }

    // reset dice rolled status to false (allow dice to be rolled again)
    match.setDiceRolled(false)

    if (match.isGameOver()) {
      io.in(matchId).emit('GAME_OVER', {
        winner: playerId
      })
    } else {
      io.in(matchId).emit('SET_NEXT_TURN', {
        playerId: match.getNextTurn()
      })
    }
  })

  // when a player disconnects, inform others
  client.on('disconnect', function () {
    console.log(playerId, 'has left')
    client.in(matchId).emit('PLAYER_LEFT', {
      playerId
    })
  })
}
