// Simple in-memory mock for local dev on Windows without Redis
const mockRedis = {
  isOpen: true,
  data: {},
  connect: async () => console.log('⚡ Mock Redis Connected (In-Memory Fallback)'),
  get: async (key) => mockRedis.data[key] || null,
  set: async (key, val) => { mockRedis.data[key] = val; return 'OK'; },
  watch: async () => {},
  unwatch: async () => {},
  incrByFloat: async (key, val) => {
    mockRedis.data[key] = (parseFloat(mockRedis.data[key] || 0) + parseFloat(val)).toString();
    return mockRedis.data[key];
  },
  multi: () => ({
    set: (key, val) => { mockRedis.data[key] = val; },
    exec: async () => [true]
  })
};

async function connectRedis() {
  console.log('⚡ Connected to Mock Redis (High-speed Cache fallback)');
}

module.exports = {
  redisClient: mockRedis,
  connectRedis
};
