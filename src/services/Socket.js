let io
const db = {
  players: null,
  matches: null,
  currentMatches: null
}

module.exports = function (server) {
  const mongo = require('mongodb').MongoClient
  const url = 'mongodb://meowmeow:1vysaur@ds014808.mlab.com:14808/ludo'
  mongo.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) {
      console.error('Mongo connection failed', err)
      return
    }
    const database = client.db('ludo')

    db.players = database.collection('players')
    db.matches = database.collection('matches')
    db.currentMatches = database.collection('currentMatches')

    console.log('Connected to DB. Collections retrieved!')

    io = require('socket.io')(server)
    io.on('connection', _onConnection)

    console.log('Socket opened. Listening...')
  })
}

const Match = require('../models/Match')

const matches = {} // list of all matches - @TODO: this should be in DB

function _onConnection (client) {
  // console.log('new connection...', client.id)

  let playerId = 'noid'
  let playerName = 'doe'
  let matchId = ''
  let match = null

  // when a player disconnects, inform others
  client.on('disconnect', function () {
    console.log(playerId, 'has left')
    client.in(matchId).emit('PLAYER_LEFT', {
      playerId
    })
  })

  client.on('HOST_MATCH', hostMatch)

  // when a new player joins, inform everyone
  client.on('JOIN_MATCH', joinMatch)

  // when player chooses what color (r/b/y/g) they are going to play with
  client.on('SELECT_COLOR', selectColor)

  // when host clicks 'start match' button
  client.on('START_MATCH', startMatch)

  // when client requests to roll dice
  client.on('TRIGGER_DICE_ROLL', triggerDiceRoll)

  // when client selects the coin they want to move
  client.on('COIN_SELECTED', coinSelected)

  function hostMatch ({ playerId: name }) {
    playerId = name // ID of current player (client)
    playerName = name
    if (!playerId) {
      return
    }

    // generate new match ID, and add it to list of all matches
    matchId = `M31291P${Object.keys(matches).length}` // some random match ID
    matches[matchId] = new Match(playerId)
    match = matches[matchId] // retrieve match details by ID

    console.log(`${playerId} hosted ${matchId}. Full details are`, match)

    // add client to room (room = match; uniquely identified by match ID)
    client.join(matchId)

    client.emit('SET_AS_HOST', {
      matchId
    })

    client.emit('CLIENT_JOINED', {
      matchId
    })

    updateMatchStateToDb()
  }

  function joinMatch ({ playerId: name, matchId: matchIdOld }) {
    // TODO: name is being used as player ID for now; rectify this; playerId should be unique
    playerId = name // ID of current player (client)
    playerName = name
    if (!playerId || !matchIdOld) {
      return
    }

    match = matches[matchIdOld] // retrieve match details by ID
    if (!match) {
      client.emit('MATCH_NOT_FOUND', {
        matches // @TODO: Temp; remove this
      })
      // host a match when no existing one is found
      hostMatch({ playerId: name })
      return
    }

    matchId = matchIdOld

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
  }

  function selectColor ({ color: home }) {
    // exit if no match found
    if (!match) {
      console.error('Match not found!', matches, matchId)
      return
    }
    // exit if player already exists in current match (i.e. they already have a color)
    if (match.checkForPlayer(playerName)) {
      return
    }

    console.log('matchId, name, home', matchId, playerName, home)

    // add player to current match
    match.addPlayer(playerId, playerName, home)

    console.log(playerId, 'has joined')

    // send all latest match data to current player
    client.emit('LATEST_MATCH_DATA', {
      playerId, // TODO: remove
      players: match.getAllPlayers(),
      status: match.getStatus(), // TODO: remove
      matchId, // TODO: remove
      name: playerName, // TODO: remove
      home
    })

    // send new joinee details to others
    client.to(matchId).emit('PLAYER_JOINED', {
      matchId, // TODO: remove
      id: playerId,
      name: playerName,
      home
    })
  }

  function startMatch () {
    const success = match ? match.startMatch() : null
    if (success) {
      io.in(matchId).emit('MATCH_STARTED')
    }
  }

  function triggerDiceRoll (number) {
    if (!match) {
      return
    }

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
      name: playerName, // TODO: remove
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
  }

  function coinSelected ({ coinId }) {
    if (!match) {
      return
    }

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
  }

  // save match's current state to database
  function updateMatchStateToDb () {
    // exit if match details are missing
    if (!matchId || !match) {
      console.log('Exiting.. Match details missing!')
      return
    }
    // exit if DB connection is busted
    if (!db || !db.currentMatches) {
      console.log('Exiting.. DB issues. Check connection & collections!')
      return
    }
    // update match details in DB for matchID
    db.currentMatches.updateOne({id: matchId}, {'$set': match.getDetails()}, {upsert: true})
      .then(() => console.log('Match details saved to DB!'))
      .catch(err => console.log('Could not update match details in DB!', err))
  }
}
