import { Hono } from 'hono'
import { upgradeWebSocket, websocket } from 'hono/bun'
import type { ServerWebSocket } from 'bun'
import { rateLimiter } from 'hono-rate-limiter'
import { AlertEmail } from './utils/alert';



const app = new Hono()
const limiter = rateLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-6",
    skip: (c) => {
        if (c.req.query("token") === Bun.env.token) {
            return c.req.query("token") === Bun.env.token
        }
        return c.req.header("Auth") === `Bearer${Bun.env.token}`
    },
    keyGenerator: (c) => c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "quest"
})

let currentStatus = {
    "status": "offline",
    "file": "",
}


app.use(limiter)


const activeSockets = new Set<ServerWebSocket>();
const writerSockets = new Set<ServerWebSocket>();
let activeWriter: ServerWebSocket | null = null;
app.get('/ws', upgradeWebSocket((c) => {
    const tokenRecibido = c.req.query("token");
    const tokenEsperado = Bun.env.token;
    const canWrite = tokenRecibido === tokenEsperado;

    console.log(`[AUTH] Recibido: "${tokenRecibido}" | Esperado: "${tokenEsperado}" | Match: ${canWrite}`);

    return {
        onOpen(_, ws) {
            const srv = ws.raw as ServerWebSocket;
            activeSockets.add(srv)

            if (canWrite) {
                writerSockets.add(srv);
                if (activeWriter) {
                    console.log("Ignoring additional writer connection");
                } else {
                    activeWriter = srv;
                    console.log("Neovim connected");
                }
            } else {
                console.log("Web client connected");
            }

            ws.send(JSON.stringify(currentStatus));
        },

        onMessage(event, ws) {
            if (!canWrite || ws.raw !== activeWriter) return

            try {

                const message = event.data.toString();
                const newData = JSON.parse(message);

                if (!newData.status) return;

                if (newData.status) {
                    currentStatus = newData;
                    activeSockets.forEach((socket) => {
                        if (socket !== ws.raw) {
                            socket.send(message);
                        }
                    });
                }
            } catch (e) {
                console.error("Error parsers:", e);
            }
        },

        onClose: (_, ws) => {
            const srv = ws.raw as ServerWebSocket;
            activeSockets.delete(srv);
            if (canWrite) writerSockets.delete(srv);

            if (srv === activeWriter) {
                activeWriter = null;
                let promoted = false;
                writerSockets.forEach((socket) => {
                    if (!promoted) {
                        activeWriter = socket;
                        promoted = true;
                        console.log("Promoting next writer connection");
                    }
                });
                if (!activeWriter) {
                    currentStatus = { status: "offline", file: "" };
                    activeSockets.forEach((socket) => {
                        socket.send(JSON.stringify(currentStatus));
                    });
                    console.log("Neovim disconnected - Status set to offline");
                }
            }
        }
    }
}))

let heartbeatTimeout: Timer | null = null;
app.post("/heartbeat", (c) => {
    if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout);
        console.log(Bun.env.email)
        console.log("received signal");
    }
    heartbeatTimeout = setTimeout(async () => {
        try {
            console.log("no received signal")
            await AlertEmail()
        } catch (err) {
            console.error("error", err)
        }
    }, 10 * 60 * 1000)
    return c.text("ok")
})


app.get('/', (c) => {
    return c.text('active uptimeRobot')
})

export default {
    port: process.env.PORT || 3000,
    fetch: app.fetch,
    websocket: { ...websocket, idleTimeout: 60 }
} 
