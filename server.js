const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Basic health route
app.get('/healthz', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);

// WebSocket signaling
const wss = new WebSocket.Server({ server, path: '/ws' });

// rooms structure: { [roomId]: { broadcaster: ws|null, viewers: Map<viewerId, ws> } }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { broadcaster: null, viewers: new Map() });
  }
  return rooms.get(roomId);
}

function safeSend(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

wss.on('connection', (ws) => {
  ws.role = null;
  ws.roomId = null;
  ws.viewerId = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }

    const { type } = msg;

    if (type === 'join') {
      const { role, room, viewerId } = msg;
      ws.role = role;
      ws.roomId = room;
      if (!room) { return; }
      const roomObj = getOrCreateRoom(room);

      if (role === 'broadcaster') {
        roomObj.broadcaster = ws;
        safeSend(ws, { type: 'joined', role: 'broadcaster', room });
        // Inform broadcaster how many viewers currently connected (but not paired)
        safeSend(ws, { type: 'viewerCount', count: roomObj.viewers.size });
      } else if (role === 'viewer') {
        ws.viewerId = viewerId || Math.random().toString(36).slice(2);
        roomObj.viewers.set(ws.viewerId, ws);
        safeSend(ws, { type: 'joined', role: 'viewer', room, viewerId: ws.viewerId });
        // Notify broadcaster there is a viewer ready (optional)
        if (roomObj.broadcaster) {
          safeSend(roomObj.broadcaster, { type: 'viewer-ready', viewerId: ws.viewerId });
        }
      }
      return;
    }

    if (!ws.roomId) return;
    const roomObj = rooms.get(ws.roomId);
    if (!roomObj) return;

    // Signaling relay
    if (type === 'offer' && ws.role === 'viewer') {
      // Relay viewer's offer to broadcaster
      if (roomObj.broadcaster) {
        safeSend(roomObj.broadcaster, { type: 'offer', viewerId: ws.viewerId, sdp: msg.sdp });
      } else {
        safeSend(ws, { type: 'error', message: 'No broadcaster in this room.' });
      }
      return;
    }

    if (type === 'answer' && ws.role === 'broadcaster') {
      const targetViewer = roomObj.viewers.get(msg.viewerId);
      if (targetViewer) {
        safeSend(targetViewer, { type: 'answer', sdp: msg.sdp });
      }
      return;
    }

    if (type === 'ice-candidate') {
      if (ws.role === 'viewer') {
        // from viewer to broadcaster
        if (roomObj.broadcaster) {
          safeSend(roomObj.broadcaster, { type: 'ice-candidate', viewerId: ws.viewerId, candidate: msg.candidate });
        }
      } else if (ws.role === 'broadcaster') {
        // from broadcaster to specific viewer
        const targetViewer = roomObj.viewers.get(msg.viewerId);
        if (targetViewer) {
          safeSend(targetViewer, { type: 'ice-candidate', candidate: msg.candidate });
        }
      }
      return;
    }
  });

  ws.on('close', () => {
    const { roomId, role, viewerId } = ws;
    if (!roomId) return;
    const roomObj = rooms.get(roomId);
    if (!roomObj) return;

    if (role === 'broadcaster') {
      // End all viewer connections
      roomObj.broadcaster = null;
      // inform viewers that stream ended
      for (const [vid, vws] of roomObj.viewers.entries()) {
        safeSend(vws, { type: 'end' });
      }
      // keep the viewers set; they might wait for a new broadcaster
    } else if (role === 'viewer') {
      roomObj.viewers.delete(viewerId);
      if (roomObj.broadcaster) {
        safeSend(roomObj.broadcaster, { type: 'viewer-left', viewerId });
        safeSend(roomObj.broadcaster, { type: 'viewerCount', count: roomObj.viewers.size });
      }
    }

    // Cleanup empty room
    if (!roomObj.broadcaster && roomObj.viewers.size === 0) {
      rooms.delete(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Webcam WebRTC app listening on http://localhost:${PORT}`);
});
