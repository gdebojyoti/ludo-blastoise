const io = require('socket.io')()

const matches = []
const matchId = 'M31291' // some random match ID
let playersCount = 0 // number of players joined since last server restart

io.on('connection', (client) => {
  console.log("new connection...")
  const playerId = ++playersCount

  client.on('subscribeToTimer', (interval) => {
    console.log('client is subscribing to timer with interval ', interval)
    setInterval(() => {
      client.emit('timer', new Date())
    }, interval)
  })

  client.on('JOIN_MATCH', ({ name, home }) => {
    console.log(name, "has joined")
    io.emit('PLAYER_JOINED', {
      matchId,
      id: `P${playerId}`,
      name,
      home
    })
  })

  client.on('disconnect', function () {
    io.emit('user disconnected')
  })
})

const port = 8000
io.listen(port)
console.log('listening on port ', port)