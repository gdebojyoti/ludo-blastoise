const io = require('socket.io')()

const Match = require('./models/Match')
const { getDiceRollNumber } = require('./utilities/generic')

const matches = []
const matchId = 'M31291' // some random match ID

matches[matchId] = new Match()

io.on('connection', (client) => {
  console.log("new connection...", client.id)
  const match = matches[matchId]
  let playerId = 'noid'
  let playerName = 'noname'
  let roll = 0 // spaces by which a coin will move

  client.join(matchId)

  // when a new player joins, inform everyone
  client.on('JOIN_MATCH', ({ name, home }) => {
    // TODO: name is being used as player ID for now; rectify this; playerId should be unique
    playerId = name
    playerName = name
    if (!name) {
      return
    }

    // if player already exists in current match
    if (match.checkForPlayer(playerId)) {
      // send all latest match data to player
      client.emit('LATEST_MATCH_DATA', {
        playerId,
        players: match.players,
        matchId,
        name,
        home
      })

      // exit
      return
    }

    // add player to current match
    match.addPlayer(playerId, name, home)

    match.setFirstTurn()

    console.log(playerId, "has joined", home)
    
    // send all latest match data to player
    client.emit('LATEST_MATCH_DATA', {
      playerId,
      players: match.players,
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
  client.on('TRIGGER_DICE_ROLL', () => {
    roll = getDiceRollNumber()

    io.in(matchId).emit('DICE_ROLLED', {
      playerId,
      name: playerName,
      roll
    })
  })

  client.on('COIN_SELECTED', ({ coinId }) => {
    const coinPath = match.getCoinPath(playerId, coinId, roll)

    // choice of coin is invalid if moves count = 0
    if (!coinPath.length) {
      return
    }

    match.playerMovesCoin(playerId, coinId, coinPath)

    const coinPosition = match.players[playerId].coins[coinId]
    io.in(matchId).emit('COIN_POSITION_UPDATED', {
      playerId,
      coinId,
      coinPosition,
      coinPath
    })

    // reset roll value
    roll = 0

    console.log("rolling dice... coin moves to", coinPosition)
  })

  // when a player disconnects, inform others
  client.on('disconnect', function () {
    console.log(playerId, "has left")
    client.in(matchId).emit('PLAYER_LEFT', {
      playerId
    })
  })
})

const port = 8000
io.listen(port)
console.log('listening on port ', port)