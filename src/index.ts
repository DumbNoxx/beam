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


app.use(limiter)


app.get('/ws', upgradeWebSocket((c) => {
  const canWrite = c.req.query("token") === Bun.env.Validate

  return {
    onOpen(_, ws) {
      const srv = ws.raw as ServerWebSocket;
      srv.subscribe("rich-presence");

      ws.send(JSON.stringify(currentStatus));
      console.log(canWrite ? "Neovim connected" : "Web client connected");
    },

    onMessage(event, ws) {
      try {
        const message = event.data.toString();
        const newData = JSON.parse(message);

        if (!newData.status) return;

        if (canWrite) {
          currentStatus = newData;
          (ws.raw as ServerWebSocket).publish("rich-presence", message);
        }
      } catch (e) {
        console.error("Error parsers:", e);
      }
    },

    onClose: (_, ws) => {
      if (canWrite) {
        currentStatus = { status: "offline", file: "" };
        (ws.raw as ServerWebSocket).publish("rich-presence", JSON.stringify(currentStatus));
        console.log("Neovim disconnected - Status set to offline");
      }
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
