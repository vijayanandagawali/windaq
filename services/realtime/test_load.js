const { io } = require('socket.io-client');

const SOCKET_URL = 'http://localhost:4000';
const NUM_CLIENTS = 100;
const ROOM = 'tg:dragon-tiger:Standard';

console.log(`🚀 Starting Load Test with ${NUM_CLIENTS} clients...`);

let connectedCount = 0;
let messageCount = 0;
let errors = 0;
const latencies = [];

const clients = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
  const socket = io(SOCKET_URL, {
    auth: { token: null }, // Guest connection
    transports: ['websocket'],
    reconnection: false
  });

  clients.push(socket);

  socket.on('connect', () => {
    connectedCount++;
    if (connectedCount === NUM_CLIENTS) {
      console.log(`✅ All ${NUM_CLIENTS} clients connected.`);
    }

    // Join room to receive tick events
    socket.emit('join_room', ROOM);
    
    // Simulate rate limit test (sending 15 messages quickly)
    if (i === 0) {
      console.log('Testing WebSocket rate limit on client 0...');
      for (let j = 0; j < 15; j++) {
         socket.emit('join_room', 'some_room'); // Should trigger rate limit on 11th
      }

      console.log('Testing HTTP Rate limit on /api/payments...');
      async function testHttpLimit() {
        let successCount = 0;
        let limitCount = 0;
        for (let j = 0; j < 15; j++) {
          const res = await fetch(`${SOCKET_URL}/api/payments`);
          if (res.status === 429) limitCount++;
          else successCount++;
        }
        console.log(`HTTP Rate Limit Test: ${successCount} Allowed, ${limitCount} Blocked (429 Too Many Requests)`);
      }
      testHttpLimit();
    }
  });

  socket.on('tg:tick', (payload) => {
    messageCount++;
    if (payload._meta) {
      const latency = Date.now() - payload._meta.ts;
      latencies.push(latency);
    }
  });

  socket.on('error', (err) => {
    errors++;
  });

  socket.on('disconnect', () => {
    connectedCount--;
  });
}

// Stats loop
const interval = setInterval(() => {
  console.log(`--- Stats ---`);
  console.log(`Connected: ${connectedCount} | Messages Rx: ${messageCount} | Errors (Rate Limits): ${errors}`);
  
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    console.log(`Client-Side Delivery Latency - p50: ${p50}ms, p95: ${p95}ms, p99: ${p99}ms`);
  }
  
  // Clear metrics window
  messageCount = 0;
  latencies.length = 0;
}, 5000);

// Cleanup
setTimeout(() => {
  clearInterval(interval);
  console.log('Load test complete, disconnecting clients.');
  clients.forEach(c => c.disconnect());
  process.exit(0);
}, 20000);
