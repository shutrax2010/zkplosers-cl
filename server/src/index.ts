import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { handleMessage } from './relay.js';
import { removePlayer } from './rooms.js';

const PORT = parseInt(process.env.PORT ?? '3001');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });
  ws.on('close', () => removePlayer(ws));
  ws.on('error', () => removePlayer(ws));
});

server.listen(PORT, () => {
  console.log(`Relay server running on port ${PORT}`);
});
