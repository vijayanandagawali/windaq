class MetricsService {
  constructor() {
    this.latencies = []; // Circular buffer or array for latencies (in ms)
    this.MAX_SAMPLES = 10000;
  }

  recordLatency(ms) {
    if (this.latencies.length >= this.MAX_SAMPLES) {
      this.latencies.shift(); // Remove oldest to prevent memory leak
    }
    this.latencies.push(ms);
  }

  getMetrics() {
    if (this.latencies.length === 0) return { p50: 0, p95: 0, p99: 0, count: 0 };

    // Sort ascending
    const sorted = [...this.latencies].sort((a, b) => a - b);
    
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { p50, p95, p99, count: sorted.length };
  }

  printMetrics() {
    const m = this.getMetrics();
    console.log(`📊 [Metrics] p50: ${m.p50}ms | p95: ${m.p95}ms | p99: ${m.p99}ms | Samples: ${m.count}`);
  }
}

module.exports = new MetricsService();
