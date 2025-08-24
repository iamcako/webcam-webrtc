const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const rooms = new Map();
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { broadcaster: null, viewers: new Map() });
  return rooms.get(roomId);
}
function safeSend(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch(e) {}
  }
}

wss.on('connection', (ws) => {
  ws.role = null; ws.roomId = null; ws.viewerId = null;
  ws.on('message', (data) => {
    let msg; try { msg = JSON.parse(data); } catch(e){ return; }
    const { type } = msg;
    if (type === 'join') {
      const { role, room, viewerId } = msg;
      ws.role = role; ws.roomId = room; ws.viewerId = viewerId || null;
      if (!room) return;
      const roomObj = getOrCreateRoom(room);
      if (role === 'broadcaster') {
        roomObj.broadcaster = ws;
        safeSend(ws, { type: 'joined', role: 'broadcaster', room });
        safeSend(ws, { type: 'viewerCount', count: roomObj.viewers.size });
      } else if (role === 'viewer') {
        if (!ws.viewerId) ws.viewerId = Math.random().toString(36).slice(2);
        roomObj.viewers.set(ws.viewerId, ws);
        safeSend(ws, { type: 'joined', role: 'viewer', room, viewerId: ws.viewerId });
        if (roomObj.broadcaster) safeSend(roomObj.broadcaster, { type: 'viewer-ready', viewerId: ws.viewerId });
      }
      return;
    }
    if (!ws.roomId) return;
    const roomObj = rooms.get(ws.roomId); if (!roomObj) return;

    if (type === 'offer' && ws.role === 'viewer') {
      if (roomObj.broadcaster) safeSend(roomObj.broadcaster, { type: 'offer', viewerId: ws.viewerId, sdp: msg.sdp });
      else safeSend(ws, { type: 'error', message: 'No broadcaster in this room.' });
      return;
    }
    if (type === 'answer' && ws.role === 'broadcaster') {
      const target = roomObj.viewers.get(msg.viewerId);
      if (target) safeSend(target, { type: 'answer', sdp: msg.sdp });
      return;
    }
    if (type === 'ice-candidate') {
      if (ws.role === 'viewer') {
        if (roomObj.broadcaster) safeSend(roomObj.broadcaster, { type: 'ice-candidate', viewerId: ws.viewerId, candidate: msg.candidate });
      } else if (ws.role === 'broadcaster') {
        const target = roomObj.viewers.get(msg.viewerId);
        if (target) safeSend(target, { type: 'ice-candidate', candidate: msg.candidate });
      }
      return;
    }
  });

  ws.on('close', () => {
    const { roomId, role, viewerId } = ws;
    if (!roomId) return;
    const roomObj = rooms.get(roomId); if (!roomObj) return;
    if (role === 'broadcaster') {
      roomObj.broadcaster = null;
      for (const [vid, vws] of roomObj.viewers.entries()) safeSend(vws, { type: 'end' });
    } else if (role === 'viewer') {
      roomObj.viewers.delete(viewerId);
      if (roomObj.broadcaster) {
        safeSend(roomObj.broadcaster, { type: 'viewer-left', viewerId });
        safeSend(roomObj.broadcaster, { type: 'viewerCount', count: roomObj.viewers.size });
      }
    }
    if (!roomObj.broadcaster && roomObj.viewers.size === 0) rooms.delete(roomId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Webcam WebRTC app on http://localhost:${PORT}`));
