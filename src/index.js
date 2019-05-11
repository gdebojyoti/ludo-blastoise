const io = require('socket.io')()

const Match = require('./models/Match')
const { getDiceRollNumber } = require('./utilities/generic')

const matches = []
const matchId = 'M31291' // some random match ID

matches[matchId] = new Match()

io.on('connection', (client) => {
  console.log("new connection...", client.id)
  const match = matches[matchId]
  let playerId = 'noname'

  client.join(matchId)

  // when a new player joins, inform everyone
  client.on('JOIN_MATCH', ({ name, home }) => {
    // TODO: name is being used as player ID for now; rectify this; playerId should be unique
    playerId = name
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
  client.on('TRIGGER_DICE_ROLL', ({ coinId }) => {
    const roll = getDiceRollNumber()

    io.in(matchId).emit('DICE_ROLLED', {
      playerId,
      roll
    })

    console.log(match)

    match.playerMovesCoin(playerId, coinId, roll)

    const coinPosition = match.players[playerId].coins[coinId]
    io.in(matchId).emit('UPDATE_COIN_POSITION', {
      playerId,
      coinId,
      coinPosition,
      roll
    })

    console.log("rolling dice... coin moves to", coinPosition)
  })

  client.on('COIN_SELECTED', data => {})

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