const io = require('socket.io')()

const matches = []
const matchId = 'M31291' // some random match ID
let playersCount = 0 // number of players joined since last server restart

io.on('connection', (client) => {
  console.log("new connection...", client.id)
  const playerId = ++playersCount
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
    console.log(name, playerId, "has joined", home)
    
    // send details to joined player
    client.emit('CLIENT_JOINED', {
      id: `P${playerId}`,
      name,
      home,
      matchId
    })

    // send new joinee details to others
    client.to(matchId).emit('PLAYER_JOINED', {
      matchId,
      id: `P${playerId}`,
      name,
      home
    })

    // test; update 'beta' coin position every 2 secs
    temp.interval = setInterval(() => {
      io.in(matchId).emit('UPDATE_COIN_POSITION', {
        playerId: `P${playerId}`,
        coinId: 'beta',
        position: ++coinPosition
      })
    }, 5000)
  })

  // when a player disconnects, inform others
  client.on('disconnect', function () {
    console.log(playerId, "has left")
    client.in(matchId).emit('PLAYER_LEFT', {
      playerId: `P${playerId}`
    })

    // temp; delete interval when player disconnects
    clearInterval(temp.interval)
  })
})

const port = 8000
io.listen(port)
console.log('listening on port ', port)