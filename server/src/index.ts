import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleMessage } from './relay.js';
import { removePlayer } from './rooms.js';

const PORT = parseInt(process.env.PORT ?? '3001');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/dist/index.js → ../../dist = repo root dist/
const staticPath = path.resolve(__dirname, '../../dist');

const app = express();
app.use(express.json());
app.use(express.static(staticPath));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// SPA fallback: React Router 等のクライアントルーティング用
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
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
  console.log(`Server running on port ${PORT}`);
});
