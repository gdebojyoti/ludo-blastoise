let io

module.exports = function (server) {
  io = require('socket.io')(server)
  io.on('connection', _onConnection)
}

const Match = require('../models/Match')

const matches = {} // list of all matches - @TODO: this should be in DB

function _onConnection (client) {
  // console.log('new connection...', client.id)

  let playerId = 'noid'
  let playerName = 'noname'
  let matchId = ''
  let match

  client.on('HOST_MATCH', ({ playerId: name }) => {
    playerId = name // ID of current player (client)
    playerName = name
    if (!playerId) {
      return
    }

    // generate new match ID, and add it to list of all matches
    matchId = `M31291P${Object.keys(matches).length}` // some random match ID
    matches[matchId] = new Match(playerId)
    match = matches[matchId] // retrieve match details by ID

    console.log(`${playerId} hosted ${matchId}`)

    // add client to room (room = match; uniquely identified by match ID)
    client.join(matchId)

    client.emit('CLIENT_JOINED', {
      matchId
    })
  })

  // when a new player joins, inform everyone
  client.on('JOIN_MATCH', ({ playerId: name, matchId }) => {
    // TODO: name is being used as player ID for now; rectify this; playerId should be unique
    playerId = name // ID of current player (client)
    playerName = name
    if (!playerId || !matchId) {
      return
    }

    match = matches[matchId] // retrieve match details by ID
    if (!match) {
      client.emit('MATCH_NOT_FOUND', {
        matches // @TODO: Temp; remove this
      })
      return
    }

    console.log(`${playerId} joined ${matchId}`)

    let dataProps = {} // additional match data to be sent to client

    // if player already exists in current match
    const playerDetails = match.getPlayerDetails(playerId)
    if (playerDetails) {
      dataProps = {
        playerId,
        name,
        home: playerDetails.home
      }

      console.log('already logged in', playerDetails)
    }

    // add client to room (room = match; uniquely identified by match ID)
    client.join(matchId)

    // send all latest match data to player
    client.emit('LATEST_MATCH_DATA', {
      players: match.getAllPlayers(),
      status: match.getStatus(),
      matchId,
      host: match.getHost(),
      ...dataProps
    })
  })

  client.on('SELECT_COLOR', ({ playerId, matchId, color }) => {
    // exit if no match found
    if (!match) { return }
    // exit if player already exists in current match
    if (match.checkForPlayer(playerId)) {
      return
    }
    onPlayerEnter(matchId, playerId, color)
  })

  // when player hosts/ joins
  const onPlayerEnter = (matchId, name, home) => {
    console.log('matchId, name, home', matchId, name, home)
    match = matches[matchId] // retrieve match details by ID

    // exit if match is not found
    if (!match) {
      console.error('Match not found!', matches, matchId)
      return
    }

    // // add client to room (room = match; uniquely identified by match ID)
    // client.join(matchId)

    // add player to current match
    match.addPlayer(playerId, name, home)

    console.log(playerId, 'has joined')

    // send all latest match data to player
    client.emit('LATEST_MATCH_DATA', {
      playerId,
      players: match.getAllPlayers(),
      status: match.getStatus(),
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
  }

  // when host clicks 'start match' button
  client.on('START_MATCH', () => {
    const started = match ? match.startMatch() : null
    if (started) {
      io.in(matchId).emit('MATCH_STARTED')
    }
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
