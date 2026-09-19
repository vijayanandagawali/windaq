const db = require('../database');
const https = require('https');

class CricketService {
  constructor() {
    this.apiKey = process.env.CRIC_API_KEY || '';
    this.entitySportToken = process.env.ENTITY_SPORT_TOKEN || '';
    this.provider = process.env.SPORTS_PROVIDER || 'INTERNAL_SIMULATOR';

    // In-memory live matches state
    this.matches = [
      {
        id: 'cric_t20_ind_pak',
        title: 'India vs Pakistan - ICC T20 World Cup Super 8',
        series: 'ICC Men\'s T20 World Cup',
        status: 'LIVE IN-PLAY',
        currentOverBall: '17.4',
        team1: { name: 'India', score: '186/3', overs: '17.4', runRate: '10.53' },
        team2: { name: 'Pakistan', score: '-', overs: '-', target: 'Yet to bat' },
        currentBatsmen: [
          { name: 'Virat Kohli*', runs: 82, balls: 53, fours: 6, sixes: 4 },
          { name: 'Suryakumar Yadav', runs: 34, balls: 16, fours: 4, sixes: 2 }
        ],
        currentBowler: { name: 'Shaheen Afridi', figures: '3.4-0-38-1' },
        lastSixBalls: ['1', '4', '6', '1', '2', '4'],
        markets: {
          matchWinner: {
            team1Back: 1.38,
            team1Lay: 1.42,
            team2Back: 2.95,
            team2Lay: 3.10
          },
          fancy: [
            { id: 'f_ind_20over', question: 'India 20 Overs Total Runs', noRuns: 208, noOdds: 1.95, yesRuns: 210, yesOdds: 1.95, status: 'OPEN' },
            { id: 'f_kohli_century', question: 'Virat Kohli to Score Century (100)', noRuns: 0, noOdds: 2.10, yesRuns: 1, yesOdds: 1.70, status: 'OPEN' },
            { id: 'f_next_wicket', question: 'Fall of 4th Wicket Over 18.5', noRuns: 0, noOdds: 1.88, yesRuns: 1, yesOdds: 1.88, status: 'OPEN' }
          ]
        }
      },
      {
        id: 'cric_ipl_csk_mi',
        title: 'Chennai Super Kings vs Mumbai Indians',
        series: 'Indian Premier League (IPL 2025)',
        status: 'UPCOMING (TODAY 7:30 PM)',
        currentOverBall: '0.0',
        team1: { name: 'CSK', score: '-', overs: '-' },
        team2: { name: 'MI', score: '-', overs: '-' },
        currentBatsmen: [],
        currentBowler: null,
        lastSixBalls: [],
        markets: {
          matchWinner: {
            team1Back: 1.90,
            team1Lay: 1.95,
            team2Back: 1.90,
            team2Lay: 1.95
          },
          fancy: [
            { id: 'f_csk_6over', question: 'CSK 6 Overs Total Runs', noRuns: 48, noOdds: 1.90, yesRuns: 50, yesOdds: 1.90, status: 'OPEN' },
            { id: 'f_toss_csk', question: 'Toss Winner CSK', noRuns: 0, noOdds: 1.95, yesRuns: 1, yesOdds: 1.95, status: 'OPEN' }
          ]
        }
      },
      {
        id: 'cric_t20_aus_eng',
        title: 'Australia vs England - 2nd T20I',
        series: 'The Ashes T20 Series',
        status: 'UPCOMING (TOMORROW 2:30 PM)',
        currentOverBall: '0.0',
        team1: { name: 'Australia', score: '-', overs: '-' },
        team2: { name: 'England', score: '-', overs: '-' },
        currentBatsmen: [],
        currentBowler: null,
        lastSixBalls: [],
        markets: {
          matchWinner: {
            team1Back: 1.82,
            team1Lay: 1.87,
            team2Back: 2.05,
            team2Lay: 2.12
          },
          fancy: [
            { id: 'f_aus_6over', question: 'Australia 6 Overs Runs', noRuns: 52, noOdds: 1.92, yesRuns: 54, yesOdds: 1.92, status: 'OPEN' }
          ]
        }
      }
    ];

    // Real-time odds tick loop (dynamic micro-movements every 3.5s)
    setInterval(() => this.tickOdds(), 3500);

    // If external API key present, start live sync poller
    if (this.apiKey || this.entitySportToken) {
      this.initExternalPoller();
    }
  }

  // Realistic live odds tick simulation
  tickOdds() {
    const liveMatch = this.matches[0];
    if (!liveMatch || liveMatch.status !== 'LIVE IN-PLAY') return;

    // Small realistic market fluctuations
    const delta = (Math.random() - 0.5) * 0.03;
    const baseTeam1 = Math.max(1.10, Math.min(4.50, liveMatch.markets.matchWinner.team1Back + delta));
    liveMatch.markets.matchWinner.team1Back = parseFloat(baseTeam1.toFixed(2));
    liveMatch.markets.matchWinner.team1Lay = parseFloat((baseTeam1 + 0.04).toFixed(2));

    const impliedProb = 1 - (1 / baseTeam1);
    const baseTeam2 = Math.max(1.15, parseFloat((1 / (impliedProb > 0.05 ? impliedProb : 0.05)).toFixed(2)));
    liveMatch.markets.matchWinner.team2Back = baseTeam2;
    liveMatch.markets.matchWinner.team2Lay = parseFloat((baseTeam2 + 0.06).toFixed(2));
  }

  // External Cricket API Poller
  initExternalPoller() {
    console.log('[Cricket Service] External API Sync Active');
    setInterval(async () => {
      try {
        await this.syncFromExternalApi();
      } catch (err) {
        console.warn('[Cricket Service] Live sync tick error:', err.message);
      }
    }, 15000); // Poll every 15s to respect rate limits
  }

  // Fetch live matches from CricAPI or EntitySport
  async syncFromExternalApi() {
    if (this.apiKey) {
      return new Promise((resolve) => {
        https.get(`https://api.cricapi.com/v1/currentMatches?apikey=${this.apiKey}&offset=0`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.status === 'success' && Array.isArray(parsed.data)) {
                this.transformCricApiMatches(parsed.data);
              }
            } catch (e) {
              console.warn('[CricAPI] Parse error:', e.message);
            }
            resolve(true);
          });
        }).on('error', (err) => {
          console.warn('[CricAPI] Network error:', err.message);
          resolve(false);
        });
      });
    }
  }

  // Transform raw external data to WinDaq Market format
  transformCricApiMatches(apiMatches) {
    if (!apiMatches || apiMatches.length === 0) return;
    const liveMatches = apiMatches.filter(m => m.matchEnded === false).slice(0, 5);

    liveMatches.forEach((m, idx) => {
      const existing = this.matches.find(x => x.id === 'cric_ext_' + m.id);
      const title = `${m.teams[0]} vs ${m.teams[1]}`;
      const series = m.name || 'Live Tournament';
      
      const matchObj = {
        id: 'cric_ext_' + m.id,
        title,
        series,
        status: m.matchStarted ? 'LIVE IN-PLAY' : 'UPCOMING',
        team1: { name: m.teams[0], score: m.score?.[0]?.r ? `${m.score[0].r}/${m.score[0].w}` : '-', overs: m.score?.[0]?.o || '-' },
        team2: { name: m.teams[1], score: m.score?.[1]?.r ? `${m.score[1].r}/${m.score[1].w}` : '-', overs: m.score?.[1]?.o || '-' },
        markets: {
          matchWinner: {
            team1Back: 1.85,
            team1Lay: 1.90,
            team2Back: 1.95,
            team2Lay: 2.02
          },
          fancy: [
            { id: `f_${m.id}_6ov`, question: `${m.teams[0]} 6 Over Runs`, noRuns: 49, noOdds: 1.90, yesRuns: 51, yesOdds: 1.90, status: 'OPEN' }
          ]
        }
      };

      if (!existing) {
        this.matches.push(matchObj);
      } else {
        Object.assign(existing, matchObj);
      }
    });
  }

  // Return all current live matches
  async getLiveMatches() {
    return this.matches;
  }

  // Place bet on sports market
  placeBet(phone, matchId, market, selection, type, odds, stake) {
    const match = this.matches.find(m => m.id === matchId);
    const matchTitle = match ? match.title : 'Live Cricket Match';
    return db.placeSportsBet(phone, matchId, matchTitle, market, selection, type, odds, stake);
  }

  // Admin Settle Bet (Credit winnings to user)
  settleBet(betId, outcome) {
    return db.settleSportsBet(betId, outcome);
  }
}

module.exports = new CricketService();
