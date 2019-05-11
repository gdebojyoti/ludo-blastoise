const io = require('socket.io')()

const Match = require('./models/Match')

const matches = []
const matchId = 'M31291' // some random match ID

matches[matchId] = new Match()

io.on('connection', (client) => {
  console.log("new connection...", client.id)
  const match = matches[matchId]
  let playerId = 'noname'
  let coinPosition = 100

  const temp = {}

  client.join(matchId)

  client.on('subscribeToTimer', (interval) => {
    console.log('client is subscribing to timer with interval ', interval)
    setInterval(() => {
      client.emit('timer', new Date())
    }, interval)
  })

  // when a new player joins, inform everyone
  client.on('JOIN_MATCH', ({ name, home }) => {
    // TODO: name is being used as player ID for now; rectify this; playerId should be unique
    playerId = name
    if (!name) {
      return
    }

    // ignore if player already exists in current match
    if (match.checkForPlayer(playerId)) {
      return
    }

    // add player to current match
    match.addPlayer(playerId, name, home)

    match.initializeFirstTurn()

    console.log(playerId, "has joined", home)
    console.log("match details", match)
    
    // send details to joined player
    client.emit('CLIENT_JOINED', {
      id: playerId,
      name,
      home,
      matchId
    })

    // send new joinee details to others
    client.to(matchId).emit('PLAYER_JOINED', {
      matchId,
      id: playerId,
      name,
      home
    })

    // test; update 'beta' coin position every 2 secs
    temp.interval = setInterval(() => {
      io.in(matchId).emit('UPDATE_COIN_POSITION', {
        playerId,
        coinId: 'beta',
        position: ++coinPosition
      })
    }, 5000)
  })

  // when a player disconnects, inform others
  client.on('disconnect', function () {
    console.log(playerId, "has left")
    client.in(matchId).emit('PLAYER_LEFT', {
      playerId
    })

    // temp; delete interval when player disconnects
    clearInterval(temp.interval)
  })
})

const port = 8000
io.listen(port)
console.log('listening on port ', port)