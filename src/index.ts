import { app } from './app'
import config from './config/config'
import { getPool } from './config/db'

const main = async () => {
  const port = config.port
  const server = app.listen(port, (err?: Error) => {
    if (err) throw err
    console.log(`Server is listening on port ${port}...`)
  })

  const shutdown = async () => {
    server.close()
    await getPool().end()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main()
