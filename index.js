const io = require('socket.io')()

io.on('connection', (client) => {
  client.on('subscribeToTimer', (interval) => {
    console.log('client is subscribing to timer with interval ', interval)
    setInterval(() => {
      client.emit('timer', new Date())
    }, interval)
  })

  client.on('disconnect', function () {
    io.emit('user disconnected')
  })
})

const port = 8000
io.listen(port)
console.log('listening on port ', port)