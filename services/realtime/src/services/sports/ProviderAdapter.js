/**
 * ISportsProvider Interface
 * Acts as an adapter contract to prevent vendor lock-in.
 */
class ISportsProvider {
  /**
   * Fetches active events from the provider.
   * @returns {Promise<Array>} List of events
   */
  async fetchLiveEvents() {
    throw new Error("Method not implemented.");
  }

  /**
   * Syncs odds and market statuses for a specific event.
   * @param {string} eventId 
   * @returns {Promise<Object>} Markets and Selections data
   */
  async syncOdds(eventId) {
    throw new Error("Method not implemented.");
  }

  /**
   * Webhook handler for external settlements or result corrections.
   */
  async handleWebhook(payload) {
    throw new Error("Method not implemented.");
  }
}

module.exports = ISportsProvider;
