import { Hono } from 'hono'
import { upgradeWebSocket, websocket } from 'hono/bun'
import type { ServerWebSocket } from 'bun'
import { rateLimiter } from 'hono-rate-limiter'


const app = new Hono()
const limiter = rateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-6",
  skip: (c) => c.req.query("token") === Bun.env.Validate,
  keyGenerator: (c) => c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "quest"
})

let currentStatus = {
  "status": "offline",
  "file": "",
}
interface ClientInterface {
  CanWritter: boolean
}

const connectedClients: Record<string, ClientInterface> = {};

app.use(limiter)

app.get('/ws', upgradeWebSocket((c) => {
  return {
    onOpen(_, ws) {
      const busWs = ws.raw as ServerWebSocket
      const authToken = c.req.query("token")
      const ip = busWs.remoteAddress;
      connectedClients[ip] = {
        CanWritter: authToken === Bun.env.Validate
      };
      busWs.subscribe("rich-presence")
      ws.send(JSON.stringify(currentStatus))
      console.log("Subscribe client")
    },
    onMessage(event, ws) {
      try {
        const newData = JSON.parse(event.data.toString());
        if (!newData.status || newData.status.length === 0) {
          return;
        }
        currentStatus = newData

        const busWs = ws.raw as ServerWebSocket

        const ip = busWs.remoteAddress;
        if (connectedClients[ip]?.CanWritter) {
          busWs.publish("rich-presence", event.data.toString())
        }

      } catch (e) {
        console.error(e)
      }
    },
    onClose: (_, ws) => {
      const busWs = ws.raw as ServerWebSocket;
      const ip = busWs.remoteAddress;
      if (connectedClients[ip]?.CanWritter) {
        currentStatus = { status: "offline", file: "" }
        busWs.publish("rich-presence", JSON.stringify(currentStatus).toString())
      }
      delete connectedClients[ip]
      console.log("connection closed")
    }
  }
}))


app.get('/', (c) => {
  return c.text('active uptimeRobot')
})

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
  websocket
} 
