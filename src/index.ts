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

type WSContext = {
  canWrite: boolean
}

app.get('/ws', upgradeWebSocket((c) => {
  let context: WSContext = { canWrite: false };

  return {
    onOpen(_, ws) {
      const busWs = ws.raw as ServerWebSocket;
      const authToken = c.req.query("token");

      if (authToken === Bun.env.Validate) {
        context.canWrite = true;
      }

      busWs.subscribe("rich-presence");

      ws.send(JSON.stringify(currentStatus));
      console.log(context.canWrite ? "Neovim connected" : "Web client connected");
    },

    onMessage(event, ws) {
      try {
        const message = event.data.toString();
        const newData = JSON.parse(message);

        if (!newData.status) return;

        if (context.canWrite) {
          currentStatus = newData;
          (ws.raw as ServerWebSocket).publish("rich-presence", message);
        }
      } catch (e) {
        console.error("Error parseando:", e);
      }
    },

    onClose: (_, ws) => {
      if (context.canWrite) {
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
