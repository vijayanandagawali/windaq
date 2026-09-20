const ISportsProvider = require('./ProviderAdapter');

/**
 * MockSportsProvider
 * Simulates a data feed for testing our engine.
 */
class MockSportsProvider extends ISportsProvider {
  constructor() {
    super();
    this.mockEvents = [
      {
        id: 'mock-evt-1',
        name: 'India vs Pakistan',
        competition: 'T20 World Cup',
        sport: 'Cricket',
        status: 'LIVE',
        startTime: new Date(),
        markets: [
          {
            id: 'mock-mkt-1',
            name: 'Match Winner',
            status: 'ACTIVE',
            selections: [
              { id: 'sel-ind', name: 'India', oddsBack: 1.45, oddsLay: 1.48, status: 'ACTIVE' },
              { id: 'sel-pak', name: 'Pakistan', oddsBack: 2.80, oddsLay: 2.85, status: 'ACTIVE' }
            ]
          }
        ]
      }
    ];
  }

  async fetchLiveEvents() {
    return this.mockEvents;
  }

  async syncOdds(eventId) {
    const event = this.mockEvents.find(e => e.id === eventId);
    if (!event) throw new Error("Event not found");
    return event.markets;
  }

  // Admin simulation tools
  simulateOddsChange(eventId, selectionId, newOddsBack) {
    const event = this.mockEvents.find(e => e.id === eventId);
    const selection = event.markets[0].selections.find(s => s.id === selectionId);
    selection.oddsBack = newOddsBack;
  }

  simulateSuspension(eventId, marketId) {
    const event = this.mockEvents.find(e => e.id === eventId);
    const market = event.markets.find(m => m.id === marketId);
    market.status = 'SUSPENDED';
  }
}

module.exports = new MockSportsProvider();
