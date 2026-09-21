/**
 * VirtualDealerRegistry.js
 * 
 * Configurable Virtual Dealer Profiles for WinDaq Automated Tables.
 * Strictly designated as VIRTUAL / SIMULATED DEALERS (never faked as real humans).
 */

const VIRTUAL_DEALERS = {
  dealer_maya: {
    dealerId: 'dealer_maya',
    displayName: 'Virtual Maya',
    title: 'Virtual Live Dealer',
    avatar: 'maya',
    genderPresentation: 'female',
    language: 'en',
    greeting: 'Welcome to WinDaq! Place your bets on Dragon, Tiger, or Tie.',
    personalityStyle: 'calm',
    animationProfile: 'smooth',
    dealingStyle: 'standard',
    speedProfile: 1.0,
    status: 'ACTIVE',
    tableAssignment: ['dragon-tiger-01', 'table-02'],
    voiceConfig: {
      enabled: true,
      pitch: 1.0,
      rate: 0.95,
      lang: 'en-US',
      lines: {
        BETTING_OPEN: 'Place your bets please! 15 seconds remaining.',
        BETTING_CLOSING: 'Final bets! Bets are closing now.',
        BETTING_CLOSED: 'No more bets, thank you. Dealing begins.',
        DEALING: 'Dealing the cards from the shoe.',
        RESULT: 'Round complete. Congratulations to all winners!',
        SETTLEMENT: 'Settling all winning wagers now.',
        NEXT_ROUND: 'Preparing table for the next round.'
      }
    }
  },
  dealer_liam: {
    dealerId: 'dealer_liam',
    displayName: 'Virtual Liam',
    title: 'Virtual Live Host',
    avatar: 'liam',
    genderPresentation: 'male',
    language: 'en',
    greeting: 'Hello players! Fast-paced table action starts right now.',
    personalityStyle: 'fast',
    animationProfile: 'brisk',
    dealingStyle: 'flair',
    speedProfile: 1.15,
    status: 'ACTIVE',
    tableAssignment: ['blackjack-01', 'table-04'],
    voiceConfig: {
      enabled: true,
      pitch: 0.9,
      rate: 1.05,
      lang: 'en-US',
      lines: {
        BETTING_OPEN: 'Chips on the felt! Action is live.',
        BETTING_CLOSING: 'Locking down bets in 3 seconds!',
        BETTING_CLOSED: 'Cards out! No more wagers.',
        DEALING: 'Dealing player and dealer hands.',
        RESULT: 'Dealer reveals! Check your cards.',
        SETTLEMENT: 'Payouts dispatched to winning seats.',
        NEXT_ROUND: 'Next round coming right up.'
      }
    }
  },
  dealer_sophia: {
    dealerId: 'dealer_sophia',
    displayName: 'Virtual Sophia',
    title: 'Virtual VIP Croupier',
    avatar: 'sophia',
    genderPresentation: 'female',
    language: 'en',
    greeting: 'Welcome distinguished guests to European Roulette. Place your stakes.',
    personalityStyle: 'vip',
    animationProfile: 'deliberate',
    dealingStyle: 'minimal',
    speedProfile: 0.9,
    status: 'ACTIVE',
    tableAssignment: ['roulette-01', 'table-01'],
    voiceConfig: {
      enabled: true,
      pitch: 1.05,
      rate: 0.9,
      lang: 'en-GB',
      lines: {
        BETTING_OPEN: 'Rien ne va plus. Please place your wagers on the layout.',
        BETTING_CLOSING: 'Final calls for wagers on the wheel.',
        BETTING_CLOSED: 'Rien ne va plus. No more bets.',
        DEALING: 'Releasing the ivory ball into the rotor.',
        RESULT: 'The ball has landed in the pocket.',
        SETTLEMENT: 'Settling winning straight and outside bets.',
        NEXT_ROUND: 'Clear the layout. Next spin in moments.'
      }
    }
  },
  dealer_arjun: {
    dealerId: 'dealer_arjun',
    displayName: 'Virtual Arjun',
    title: 'Virtual Card Master',
    avatar: 'arjun',
    genderPresentation: 'male',
    language: 'en',
    greeting: 'Namaste! Welcome to Andar Bahar. Choose your side!',
    personalityStyle: 'classic',
    animationProfile: 'standard',
    dealingStyle: 'standard',
    speedProfile: 1.0,
    status: 'ACTIVE',
    tableAssignment: ['andar-bahar-01', 'table-03', 'teen-patti-01', 'table-05'],
    voiceConfig: {
      enabled: true,
      pitch: 0.95,
      rate: 1.0,
      lang: 'en-IN',
      lines: {
        BETTING_OPEN: 'Namaste! Bets are open. Andar or Bahar?',
        BETTING_CLOSING: 'Locking bets! Joker card is set.',
        BETTING_CLOSED: 'Bets locked. Dealing to Andar and Bahar now.',
        DEALING: 'Dealing cards sequentially...',
        RESULT: 'Matching card landed! Winning side confirmed.',
        SETTLEMENT: 'Pari-mutuel and table winnings credited.',
        NEXT_ROUND: 'Reshuffling the cut card. New round begins.'
      }
    }
  }
};

class VirtualDealerRegistry {
  constructor() {
    this.dealers = { ...VIRTUAL_DEALERS };
  }

  getDealer(dealerId) {
    return this.dealers[dealerId] || this.dealers['dealer_maya'];
  }

  getAllDealers() {
    return Object.values(this.dealers);
  }

  getDealerSpeech(dealerId, phase, gameId = '', result = null) {
    const dealer = this.getDealer(dealerId);
    if (!dealer) return 'Welcome to the automated table.';

    // Custom outcome-tailored speech
    if (phase === 'RESULT' && result) {
      if (gameId === 'dragon-tiger' && result.winner) {
        return result.winner === 'TIE' 
          ? `It's a TIE! Incredible 8 to 1 payout on the tie.`
          : `${result.winner} WINS the round! Congratulations to all winning bets!`;
      }
      if (gameId === 'roulette' && result.number !== undefined) {
        return `Number ${result.number} ${result.color || ''}! ${result.isEven ? 'Even' : 'Odd'}. Congratulations!`;
      }
      if (gameId === 'andar-bahar' && result.winner) {
        return `${result.winner} WINS! Matched on card #${result.totalCardsDealt || 1}!`;
      }
    }

    const lines = dealer.voiceConfig?.lines || {};
    return lines[phase] || dealer.greeting || 'Table action in progress.';
  }

  updateDealerProfile(dealerId, updates) {
    if (!this.dealers[dealerId]) {
      throw new Error(`Dealer with ID ${dealerId} not found`);
    }
    this.dealers[dealerId] = {
      ...this.dealers[dealerId],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return this.dealers[dealerId];
  }

  registerDealer(profile) {
    if (!profile.dealerId) {
      throw new Error('Dealer profile requires dealerId');
    }
    this.dealers[profile.dealerId] = {
      status: 'ACTIVE',
      speedProfile: 1.0,
      personalityStyle: 'classic',
      ...profile
    };
    return this.dealers[profile.dealerId];
  }
}

// Export singleton instance
const dealerRegistry = new VirtualDealerRegistry();
module.exports = {
  VirtualDealerRegistry,
  dealerRegistry,
  VIRTUAL_DEALERS
};
