/**
 * WinDaq Original Artwork Generator
 * Generates bespoke, high-resolution vector SVG artwork for all 16 games:
 * - 16:9 Hero widescreen artwork (1920x1080)
 * - 4:5 Game Card portrait artwork (800x1000)
 * - 1:1 Mobile artwork (600x600)
 * - Bulletproof Inline SVG Fallback
 * 
 * Also generates apps/web/src/lib/gameArtwork.ts with data URIs and metadata.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../apps/web/public/artwork/games');
const ROOT_OUTPUT_DIR = path.resolve(__dirname, '../public/artwork/games');
const LIB_FILE = path.resolve(__dirname, '../apps/web/src/lib/gameArtwork.ts');

[OUTPUT_DIR, ROOT_OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const gamesList = [
  {
    slug: 'aviator',
    name: 'Aviator Crash',
    category: 'Crash',
    categorySlug: 'crash',
    provider: 'Spribe & WinDaq',
    variant: 'Supersonic',
    themeColor: '#FF3366',
    secondaryColor: '#FF6B8B',
    bgGradient: ['#14070e', '#2b0819', '#420d23'],
    badge: '12.45x CRASH',
    tag: 'CRASH',
    rtp: '97.0%',
    minBet: '₹10',
    maxPayout: '10,000x',
    accentSvg: `
      <!-- Radar grid -->
      <g opacity="0.25" stroke="#FF3366" stroke-width="1.5" stroke-dasharray="6,6">
        <circle cx="500" cy="500" r="150" fill="none"/>
        <circle cx="500" cy="500" r="300" fill="none"/>
        <circle cx="500" cy="500" r="450" fill="none"/>
        <line x1="50" y1="500" x2="950" y2="500"/>
        <line x1="500" y1="50" x2="500" y2="950"/>
      </g>
      <!-- Exponential curve -->
      <path d="M 100 800 Q 400 780 600 500 T 880 220" fill="none" stroke="#FF3366" stroke-width="8" stroke-linecap="round"/>
      <path d="M 100 800 Q 400 780 600 500 T 880 220 L 880 800 Z" fill="url(#curveGlow)" opacity="0.25"/>
      <!-- Jet Plane -->
      <g transform="translate(820, 200) rotate(-35) scale(1.6)">
        <polygon points="0,-40 25,30 0,20 -25,30" fill="#FFFFFF"/>
        <polygon points="0,-40 10,25 0,18 -10,25" fill="#FF3366"/>
        <polygon points="0,20 15,40 0,35 -15,40" fill="#FF8C00"/>
        <!-- Jet exhaust flame -->
        <ellipse cx="0" cy="45" rx="8" ry="25" fill="#FFD700" opacity="0.8"/>
        <ellipse cx="0" cy="48" rx="4" ry="15" fill="#FF3366" opacity="0.9"/>
      </g>
      <!-- Multiplier Pill -->
      <g transform="translate(500, 380)">
        <rect x="-140" y="-45" width="280" height="90" rx="45" fill="#FF3366" filter="url(#dropGlow)"/>
        <text x="0" y="14" font-family="'Outfit', 'Inter', sans-serif" font-size="44" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">18.42x</text>
      </g>
    `
  },
  {
    slug: 'colour-prediction',
    name: 'Colour Prediction',
    category: 'Colour',
    categorySlug: 'colour',
    provider: 'WinDaq Originals',
    variant: '1-Min Fast',
    themeColor: '#00FFA3',
    secondaryColor: '#8A2BE2',
    bgGradient: ['#06111f', '#0b1d33', '#112b4d'],
    badge: 'WIN 2x - 9x',
    tag: 'COLOUR',
    rtp: '97.5%',
    minBet: '₹10',
    maxPayout: '9x',
    accentSvg: `
      <!-- Trichromatic Glowing Wheel -->
      <g transform="translate(500, 500)">
        <!-- Outer neon ring -->
        <circle cx="0" cy="0" r="320" fill="none" stroke="#00FFA3" stroke-width="4" opacity="0.4" stroke-dasharray="10,10"/>
        <circle cx="0" cy="0" r="300" fill="#0b1726" stroke="#1f334d" stroke-width="8"/>
        
        <!-- Red segment -->
        <path d="M 0 0 L -250 -144 A 290 290 0 0 1 0 -290 Z" fill="#FF3366" opacity="0.9"/>
        <!-- Green segment -->
        <path d="M 0 0 L 0 -290 A 290 290 0 0 1 250 -144 Z" fill="#00FFA3" opacity="0.9"/>
        <!-- Violet segment -->
        <path d="M 0 0 L 250 -144 A 290 290 0 0 1 0 290 Z" fill="#8A2BE2" opacity="0.9"/>
        <!-- Red lower segment -->
        <path d="M 0 0 L 0 290 A 290 290 0 0 1 -250 144 Z" fill="#FF3366" opacity="0.9"/>
        <!-- Green lower segment -->
        <path d="M 0 0 L -250 144 A 290 290 0 0 1 -250 -144 Z" fill="#00FFA3" opacity="0.85"/>

        <!-- Center dial core -->
        <circle cx="0" cy="0" r="110" fill="#060c14" stroke="#00FFA3" stroke-width="6"/>
        <circle cx="0" cy="0" r="85" fill="url(#neonCenterGlow)"/>
        <text x="0" y="12" font-family="'Outfit', sans-serif" font-size="34" font-weight="900" fill="#FFFFFF" text-anchor="middle">1 MIN</text>
        
        <!-- Pointer Needle -->
        <polygon points="0,-330 -22,-270 22,-270" fill="#FFD700" filter="url(#dropGlow)"/>
        <circle cx="0" cy="-290" r="8" fill="#FFFFFF"/>
      </g>
      <!-- Color choice capsules -->
      <g transform="translate(500, 840)">
        <rect x="-240" y="-30" width="140" height="60" rx="30" fill="#00FFA3" opacity="0.9"/>
        <text x="-170" y="10" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#06111f" text-anchor="middle">GREEN</text>
        
        <rect x="-70" y="-30" width="140" height="60" rx="30" fill="#8A2BE2" opacity="0.9"/>
        <text x="0" y="10" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#FFFFFF" text-anchor="middle">VIOLET</text>
        
        <rect x="100" y="-30" width="140" height="60" rx="30" fill="#FF3366" opacity="0.9"/>
        <text x="170" y="10" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#FFFFFF" text-anchor="middle">RED</text>
      </g>
    `
  },
  {
    slug: 'slots',
    name: 'Ocean Treasures',
    category: 'Slots',
    categorySlug: 'slots',
    provider: 'WinDaq Originals',
    variant: 'Megaways 243',
    themeColor: '#FFB800',
    secondaryColor: '#00F0FF',
    bgGradient: ['#051329', '#08254c', '#0f3c78'],
    badge: 'MEGAWAYS',
    tag: 'SLOTS',
    rtp: '96.5%',
    minBet: '₹10',
    maxPayout: '50,000x',
    accentSvg: `
      <!-- Slot Machine Window -->
      <g transform="translate(500, 480)">
        <!-- Machine frame -->
        <rect x="-360" y="-280" width="720" height="560" rx="32" fill="#0b1b36" stroke="#FFB800" stroke-width="8" filter="url(#dropGlow)"/>
        <rect x="-330" y="-250" width="660" height="420" rx="20" fill="#050e1f" stroke="#1b355d" stroke-width="4"/>
        
        <!-- 3 Slot Reels -->
        <!-- Reel 1 -->
        <rect x="-300" y="-220" width="180" height="360" rx="16" fill="#0a162b" stroke="#FFB800" stroke-width="3"/>
        <text x="-210" y="0" font-family="'Outfit', sans-serif" font-size="110" font-weight="900" fill="#FFB800" text-anchor="middle">7</text>
        <!-- Reel 2 -->
        <rect x="-90" y="-220" width="180" height="360" rx="16" fill="#0a162b" stroke="#00F0FF" stroke-width="3"/>
        <text x="0" y="0" font-family="'Outfit', sans-serif" font-size="110" font-weight="900" fill="#FF3366" text-anchor="middle">7</text>
        <!-- Reel 3 -->
        <rect x="120" y="-220" width="180" height="360" rx="16" fill="#0a162b" stroke="#FFB800" stroke-width="3"/>
        <text x="210" y="0" font-family="'Outfit', sans-serif" font-size="110" font-weight="900" fill="#00FFA3" text-anchor="middle">7</text>
        
        <!-- Payline laser -->
        <line x1="-330" y1="-30" x2="330" y2="-30" stroke="#FFD700" stroke-width="6" stroke-dasharray="12,6"/>
        
        <!-- Jackpot Banner -->
        <rect x="-220" y="200" width="440" height="60" rx="30" fill="url(#goldGradient)" stroke="#FFFFFF" stroke-width="2"/>
        <text x="0" y="242" font-family="'Outfit', sans-serif" font-size="32" font-weight="900" fill="#051329" text-anchor="middle" letter-spacing="4">MEGA JACKPOT</text>
      </g>
    `
  },
  {
    slug: 'scratch',
    name: 'Lucky 7 Scratch',
    category: 'Scratch',
    categorySlug: 'scratch',
    provider: 'WinDaq Originals',
    variant: 'Instant Win',
    themeColor: '#F59E0B',
    secondaryColor: '#E11D48',
    bgGradient: ['#1a0f05', '#2b1908', '#42240a'],
    badge: '10,000x JACKPOT',
    tag: 'SCRATCH',
    rtp: '95.0%',
    minBet: '₹50',
    maxPayout: '10,000x',
    accentSvg: `
      <!-- Scratchcard Grid -->
      <g transform="translate(500, 490)">
        <!-- Card base -->
        <rect x="-340" y="-300" width="680" height="600" rx="36" fill="#261608" stroke="#F59E0B" stroke-width="8" filter="url(#dropGlow)"/>
        
        <!-- Gold foil header -->
        <rect x="-300" y="-260" width="600" height="100" rx="20" fill="url(#goldGradient)"/>
        <text x="0" y="-195" font-family="'Outfit', sans-serif" font-size="44" font-weight="900" fill="#1a0f05" text-anchor="middle" letter-spacing="3">LUCKY 7 SCRATCH</text>
        
        <!-- 3x3 scratch cells -->
        <!-- Row 1 -->
        <rect x="-260" y="-130" width="150" height="120" rx="18" fill="#42240a" stroke="#F59E0B" stroke-width="3"/>
        <text x="-185" y="-50" font-family="'Outfit', sans-serif" font-size="64" font-weight="900" fill="#FFD700" text-anchor="middle">7</text>
        
        <rect x="-75" y="-130" width="150" height="120" rx="18" fill="#42240a" stroke="#F59E0B" stroke-width="3"/>
        <text x="0" y="-50" font-family="'Outfit', sans-serif" font-size="64" font-weight="900" fill="#FFD700" text-anchor="middle">7</text>
        
        <rect x="110" y="-130" width="150" height="120" rx="18" fill="#42240a" stroke="#F59E0B" stroke-width="3"/>
        <text x="185" y="-50" font-family="'Outfit', sans-serif" font-size="64" font-weight="900" fill="#FFD700" text-anchor="middle">7</text>

        <!-- Row 2 -->
        <rect x="-260" y="20" width="150" height="120" rx="18" fill="#3a1e08" stroke="#F59E0B" stroke-width="2"/>
        <circle cx="-185" cy="80" r="35" fill="#E11D48"/>
        <text x="-185" y="92" font-family="'Outfit', sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle">💎</text>
        
        <rect x="-75" y="20" width="150" height="120" rx="18" fill="#3a1e08" stroke="#F59E0B" stroke-width="2"/>
        <circle cx="0" cy="80" r="35" fill="#E11D48"/>
        <text x="0" y="92" font-family="'Outfit', sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle">👑</text>
        
        <rect x="110" y="20" width="150" height="120" rx="18" fill="#3a1e08" stroke="#F59E0B" stroke-width="2"/>
        <circle cx="185" cy="80" r="35" fill="#E11D48"/>
        <text x="185" y="92" font-family="'Outfit', sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle">⭐</text>

        <!-- Match 3 win label -->
        <rect x="-200" y="180" width="400" height="70" rx="35" fill="#E11D48" stroke="#FFFFFF" stroke-width="2"/>
        <text x="0" y="227" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" fill="#FFFFFF" text-anchor="middle">MATCH 3 TO WIN ₹1,00,000</text>
      </g>
    `
  },
  {
    slug: 'lotto',
    name: 'Quick Draw 6/49',
    category: 'Lotto',
    categorySlug: 'lotto',
    provider: 'WinDaq Originals',
    variant: '5-Min Draw',
    themeColor: '#38BDF8',
    secondaryColor: '#6366F1',
    bgGradient: ['#05152b', '#09254d', '#0e3975'],
    badge: 'DAILY ₹1 CRORE',
    tag: 'LOTTO',
    rtp: '85.0%',
    minBet: '₹100',
    maxPayout: '100,000x',
    accentSvg: `
      <!-- Lotto Machine / Floating Spheres -->
      <g transform="translate(500, 480)">
        <!-- Glowing draw chamber ring -->
        <circle cx="0" cy="0" r="320" fill="none" stroke="#38BDF8" stroke-width="6" opacity="0.4" stroke-dasharray="16,8"/>
        <circle cx="0" cy="0" r="280" fill="#061933" stroke="#1d4273" stroke-width="6"/>

        <!-- 5 3D Lotto Balls -->
        <!-- Ball 1 -->
        <g transform="translate(-160, -110)">
          <circle cx="0" cy="0" r="68" fill="url(#ballGold)" filter="url(#dropGlow)"/>
          <circle cx="0" cy="0" r="42" fill="#FFFFFF"/>
          <text x="0" y="13" font-family="'Outfit', sans-serif" font-size="38" font-weight="900" fill="#1e1e1e" text-anchor="middle">07</text>
        </g>
        <!-- Ball 2 -->
        <g transform="translate(0, -150)">
          <circle cx="0" cy="0" r="74" fill="url(#ballRed)" filter="url(#dropGlow)"/>
          <circle cx="0" cy="0" r="46" fill="#FFFFFF"/>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="42" font-weight="900" fill="#1e1e1e" text-anchor="middle">14</text>
        </g>
        <!-- Ball 3 -->
        <g transform="translate(160, -90)">
          <circle cx="0" cy="0" r="66" fill="url(#ballGreen)" filter="url(#dropGlow)"/>
          <circle cx="0" cy="0" r="40" fill="#FFFFFF"/>
          <text x="0" y="13" font-family="'Outfit', sans-serif" font-size="36" font-weight="900" fill="#1e1e1e" text-anchor="middle">21</text>
        </g>
        <!-- Ball 4 -->
        <g transform="translate(-100, 90)">
          <circle cx="0" cy="0" r="72" fill="url(#ballBlue)" filter="url(#dropGlow)"/>
          <circle cx="0" cy="0" r="44" fill="#FFFFFF"/>
          <text x="0" y="14" font-family="'Outfit', sans-serif" font-size="40" font-weight="900" fill="#1e1e1e" text-anchor="middle">35</text>
        </g>
        <!-- Ball 5 (Center highlight) -->
        <g transform="translate(90, 80)">
          <circle cx="0" cy="0" r="82" fill="url(#ballPurple)" filter="url(#dropGlow)"/>
          <circle cx="0" cy="0" r="50" fill="#FFFFFF"/>
          <text x="0" y="16" font-family="'Outfit', sans-serif" font-size="46" font-weight="900" fill="#1e1e1e" text-anchor="middle">49</text>
        </g>

        <!-- Prize Pool Bar -->
        <rect x="-240" y="220" width="480" height="70" rx="35" fill="#6366F1" stroke="#38BDF8" stroke-width="3"/>
        <text x="0" y="266" font-family="'Outfit', sans-serif" font-size="30" font-weight="900" fill="#FFFFFF" text-anchor="middle">NEXT DRAW: 04m 22s</text>
      </g>
    `
  },
  {
    slug: 'teen-patti',
    name: 'Teen Patti Classic',
    category: 'Teen Patti',
    categorySlug: 'teen-patti',
    provider: 'WinDaq Live',
    variant: 'Royal Table',
    themeColor: '#EC4899',
    secondaryColor: '#F59E0B',
    bgGradient: ['#240713', '#3d0c21', '#591231'],
    badge: 'ROYAL TRAIL',
    tag: 'TEEN PATTI',
    rtp: '98.0%',
    minBet: '₹10',
    maxPayout: '500x',
    accentSvg: `
      <!-- 3 Royal Cards Fanned Out -->
      <g transform="translate(500, 500)">
        <!-- Left Card (A Diamonds) -->
        <g transform="translate(-140, 20) rotate(-18)">
          <rect x="-110" y="-170" width="220" height="340" rx="16" fill="#FFFFFF" stroke="#F59E0B" stroke-width="5" filter="url(#dropGlow)"/>
          <text x="-75" y="-115" font-family="'Outfit', sans-serif" font-size="44" font-weight="900" fill="#E11D48">A</text>
          <text x="-75" y="-70" font-family="'Outfit', sans-serif" font-size="36" fill="#E11D48">♦</text>
          <text x="0" y="30" font-family="'Outfit', sans-serif" font-size="90" fill="#E11D48" text-anchor="middle">♦</text>
        </g>
        
        <!-- Right Card (A Clubs) -->
        <g transform="translate(140, 20) rotate(18)">
          <rect x="-110" y="-170" width="220" height="340" rx="16" fill="#FFFFFF" stroke="#F59E0B" stroke-width="5" filter="url(#dropGlow)"/>
          <text x="-75" y="-115" font-family="'Outfit', sans-serif" font-size="44" font-weight="900" fill="#1e1e1e">A</text>
          <text x="-75" y="-70" font-family="'Outfit', sans-serif" font-size="36" fill="#1e1e1e">♣</text>
          <text x="0" y="30" font-family="'Outfit', sans-serif" font-size="90" fill="#1e1e1e" text-anchor="middle">♣</text>
        </g>

        <!-- Center Card (A Hearts - Foreground) -->
        <g transform="translate(0, -20)">
          <rect x="-120" y="-180" width="240" height="360" rx="18" fill="#FFFFFF" stroke="#EC4899" stroke-width="6" filter="url(#dropGlow)"/>
          <text x="-80" y="-120" font-family="'Outfit', sans-serif" font-size="48" font-weight="900" fill="#E11D48">A</text>
          <text x="-80" y="-70" font-family="'Outfit', sans-serif" font-size="40" fill="#E11D48">♥</text>
          <text x="0" y="35" font-family="'Outfit', sans-serif" font-size="100" fill="#E11D48" text-anchor="middle">♥</text>
        </g>

        <!-- Gold Chips in foreground -->
        <g transform="translate(0, 260)">
          <ellipse cx="-80" cy="0" rx="60" ry="24" fill="#F59E0B" stroke="#FFFFFF" stroke-width="3"/>
          <ellipse cx="80" cy="0" rx="60" ry="24" fill="#EC4899" stroke="#FFFFFF" stroke-width="3"/>
          <ellipse cx="0" cy="-15" rx="75" ry="30" fill="url(#goldGradient)" stroke="#FFFFFF" stroke-width="4"/>
          <text x="0" y="-6" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" fill="#240713" text-anchor="middle">₹10,000</text>
        </g>
      </g>
    `
  },
  {
    slug: 'texas-holdem',
    name: "Texas Hold'em Poker",
    category: 'Poker',
    categorySlug: 'poker',
    provider: 'WinDaq Poker',
    variant: 'No Limit VIP',
    themeColor: '#10B981',
    secondaryColor: '#3B82F6',
    bgGradient: ['#051c14', '#0a2f22', '#104734'],
    badge: 'ROYAL FLUSH',
    tag: 'POKER',
    rtp: '98.5%',
    minBet: '₹50',
    maxPayout: 'Pot Limit',
    accentSvg: `
      <!-- Monte Carlo Poker Table Layout -->
      <g transform="translate(500, 480)">
        <!-- Oval Felt Ring -->
        <ellipse cx="0" cy="0" rx="420" ry="260" fill="#0c3829" stroke="#10B981" stroke-width="8" filter="url(#dropGlow)"/>
        <ellipse cx="0" cy="0" rx="380" ry="220" fill="#08291d" stroke="#165b43" stroke-width="4"/>
        
        <!-- Royal Flush Cards (10, J, Q, K, A Spades) -->
        <g transform="translate(-160, -30) rotate(-12)">
          <rect x="-45" y="-70" width="90" height="140" rx="8" fill="#FFFFFF" stroke="#10B981" stroke-width="3"/>
          <text x="-30" y="-40" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#1e1e1e">10</text>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="34" fill="#1e1e1e" text-anchor="middle">♠</text>
        </g>
        <g transform="translate(-80, -45) rotate(-6)">
          <rect x="-45" y="-70" width="90" height="140" rx="8" fill="#FFFFFF" stroke="#10B981" stroke-width="3"/>
          <text x="-30" y="-40" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#1e1e1e">J</text>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="34" fill="#1e1e1e" text-anchor="middle">♠</text>
        </g>
        <g transform="translate(0, -50)">
          <rect x="-45" y="-70" width="90" height="140" rx="8" fill="#FFFFFF" stroke="#10B981" stroke-width="3"/>
          <text x="-30" y="-40" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#1e1e1e">Q</text>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="34" fill="#1e1e1e" text-anchor="middle">♠</text>
        </g>
        <g transform="translate(80, -45) rotate(6)">
          <rect x="-45" y="-70" width="90" height="140" rx="8" fill="#FFFFFF" stroke="#10B981" stroke-width="3"/>
          <text x="-30" y="-40" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#1e1e1e">K</text>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="34" fill="#1e1e1e" text-anchor="middle">♠</text>
        </g>
        <g transform="translate(160, -30) rotate(12)">
          <rect x="-45" y="-70" width="90" height="140" rx="8" fill="#FFFFFF" stroke="#10B981" stroke-width="3"/>
          <text x="-30" y="-40" font-family="'Outfit', sans-serif" font-size="22" font-weight="900" fill="#1e1e1e">A</text>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="36" fill="#1e1e1e" text-anchor="middle">♠</text>
        </g>

        <!-- Chips Stack and Dealer Button -->
        <g transform="translate(-180, 110)">
          <circle cx="0" cy="0" r="36" fill="#FFFFFF" stroke="#333333" stroke-width="4"/>
          <text x="0" y="10" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" fill="#111111" text-anchor="middle">DEALER</text>
        </g>
        <g transform="translate(140, 110)">
          <ellipse cx="0" cy="15" rx="55" ry="20" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
          <ellipse cx="0" cy="0" rx="55" ry="20" fill="#EF4444" stroke="#FFFFFF" stroke-width="2"/>
          <ellipse cx="0" cy="-15" rx="55" ry="20" fill="#10B981" stroke="#FFFFFF" stroke-width="2"/>
          <text x="0" y="-8" font-family="'Outfit', sans-serif" font-size="22" font-weight="900" fill="#FFFFFF" text-anchor="middle">ALL-IN</text>
        </g>
      </g>
    `
  },
  {
    slug: 'rummy',
    name: 'Indian Rummy',
    category: 'Rummy',
    categorySlug: 'rummy',
    provider: 'WinDaq Originals',
    variant: '13 Cards Points',
    themeColor: '#8B5CF6',
    secondaryColor: '#F43F5E',
    bgGradient: ['#160e29', '#271747', '#3b2169'],
    badge: '13 CARDS',
    tag: 'RUMMY',
    rtp: '97.0%',
    minBet: '₹10',
    maxPayout: '80 Points',
    accentSvg: `
      <!-- 13-Card Sequence Fan & Joker -->
      <g transform="translate(500, 490)">
        <!-- Table felt circle -->
        <circle cx="0" cy="0" r="320" fill="#1c1133" stroke="#8B5CF6" stroke-width="6" opacity="0.6"/>

        <!-- Pure Sequence Cards -->
        <g transform="translate(-140, -40) rotate(-16)">
          <rect x="-50" y="-85" width="100" height="170" rx="10" fill="#FFFFFF" stroke="#8B5CF6" stroke-width="3"/>
          <text x="-32" y="-50" font-family="'Outfit', sans-serif" font-size="26" font-weight="900" fill="#E11D48">7</text>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="44" fill="#E11D48" text-anchor="middle">♥</text>
        </g>
        <g transform="translate(-50, -60) rotate(-6)">
          <rect x="-50" y="-85" width="100" height="170" rx="10" fill="#FFFFFF" stroke="#8B5CF6" stroke-width="3"/>
          <text x="-32" y="-50" font-family="'Outfit', sans-serif" font-size="26" font-weight="900" fill="#E11D48">8</text>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="44" fill="#E11D48" text-anchor="middle">♥</text>
        </g>
        <g transform="translate(40, -60) rotate(4)">
          <rect x="-50" y="-85" width="100" height="170" rx="10" fill="#FFFFFF" stroke="#8B5CF6" stroke-width="3"/>
          <text x="-32" y="-50" font-family="'Outfit', sans-serif" font-size="26" font-weight="900" fill="#E11D48">9</text>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="44" fill="#E11D48" text-anchor="middle">♥</text>
        </g>

        <!-- Wild Joker Card (Foreground) -->
        <g transform="translate(140, -20) rotate(16)">
          <rect x="-60" y="-95" width="120" height="190" rx="12" fill="#FDF4FF" stroke="#F43F5E" stroke-width="5" filter="url(#dropGlow)"/>
          <text x="-40" y="-60" font-family="'Outfit', sans-serif" font-size="26" font-weight="900" fill="#8B5CF6">JK</text>
          <text x="0" y="20" font-family="'Outfit', sans-serif" font-size="52" fill="#F43F5E" text-anchor="middle">🃏</text>
          <rect x="-45" y="55" width="90" height="24" rx="12" fill="#8B5CF6"/>
          <text x="0" y="72" font-family="'Outfit', sans-serif" font-size="14" font-weight="900" fill="#FFFFFF" text-anchor="middle">JOKER</text>
        </g>

        <!-- Pure Sequence Verified Badge -->
        <rect x="-200" y="180" width="400" height="66" rx="33" fill="#10B981" stroke="#FFFFFF" stroke-width="3"/>
        <text x="0" y="224" font-family="'Outfit', sans-serif" font-size="26" font-weight="900" fill="#FFFFFF" text-anchor="middle">✓ PURE SEQUENCE (0 PTS)</text>
      </g>
    `
  },
  {
    slug: 'european-roulette',
    name: 'European Roulette',
    category: 'Roulette',
    categorySlug: 'roulette',
    provider: 'WinDaq Originals',
    variant: 'Single Zero',
    themeColor: '#E11D48',
    secondaryColor: '#F59E0B',
    bgGradient: ['#17070a', '#2b0c13', '#45131f'],
    badge: 'SINGLE ZERO 35:1',
    tag: 'ROULETTE',
    rtp: '97.3%',
    minBet: '₹10',
    maxPayout: '36x',
    accentSvg: `
      <!-- Realistic Roulette Wheel -->
      <g transform="translate(500, 480)">
        <!-- Outer Mahogany ring -->
        <circle cx="0" cy="0" r="330" fill="#2b0e08" stroke="#F59E0B" stroke-width="8" filter="url(#dropGlow)"/>
        <!-- Gold track -->
        <circle cx="0" cy="0" r="300" fill="#0f0507" stroke="#F59E0B" stroke-width="4"/>
        
        <!-- Pockets ring -->
        <circle cx="0" cy="0" r="260" fill="none" stroke="#E11D48" stroke-width="36" stroke-dasharray="14,14"/>
        
        <!-- Center brass turret & cone -->
        <circle cx="0" cy="0" r="140" fill="url(#goldGradient)" stroke="#5e3a09" stroke-width="6"/>
        <circle cx="0" cy="0" r="70" fill="#241005"/>
        
        <!-- Turret cross handles -->
        <line x1="-120" y1="0" x2="120" y2="0" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
        <line x1="0" y1="-120" x2="0" y2="120" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
        <circle cx="0" cy="0" r="24" fill="#FFFFFF"/>

        <!-- Single Green 0 Pocket -->
        <rect x="-24" y="-280" width="48" height="36" rx="6" fill="#10B981"/>
        <text x="0" y="-254" font-family="'Outfit', sans-serif" font-size="22" font-weight="900" fill="#FFFFFF" text-anchor="middle">0</text>

        <!-- Ivory Ball on rim -->
        <circle cx="180" cy="-160" r="18" fill="#FFFFFF" filter="url(#dropGlow)"/>
        <circle cx="176" cy="-164" r="5" fill="#E2E8F0"/>
      </g>
    `
  },
  {
    slug: 'blackjack',
    name: 'Blackjack 21',
    category: 'Blackjack',
    categorySlug: 'blackjack',
    provider: 'WinDaq Originals',
    variant: 'Classic 3:2',
    themeColor: '#059669',
    secondaryColor: '#D97706',
    bgGradient: ['#03170e', '#072b1a', '#0c4228'],
    badge: 'PAYS 3:2',
    tag: 'BLACKJACK',
    rtp: '99.5%',
    minBet: '₹50',
    maxPayout: '3:2',
    accentSvg: `
      <!-- Blackjack 21 Hand on Emerald Felt -->
      <g transform="translate(500, 480)">
        <!-- Table curve arc -->
        <path d="M -400 150 Q 0 -220 400 150" fill="none" stroke="#059669" stroke-width="6" opacity="0.6"/>
        
        <!-- Card 1: Ace of Spades -->
        <g transform="translate(-90, -30) rotate(-10)">
          <rect x="-100" y="-150" width="200" height="300" rx="16" fill="#FFFFFF" stroke="#059669" stroke-width="5" filter="url(#dropGlow)"/>
          <text x="-70" y="-100" font-family="'Outfit', sans-serif" font-size="40" font-weight="900" fill="#111111">A</text>
          <text x="-70" y="-60" font-family="'Outfit', sans-serif" font-size="32" fill="#111111">♠</text>
          <text x="0" y="30" font-family="'Outfit', sans-serif" font-size="80" fill="#111111" text-anchor="middle">♠</text>
        </g>

        <!-- Card 2: Jack of Clubs (21!) -->
        <g transform="translate(80, -10) rotate(10)">
          <rect x="-100" y="-150" width="200" height="300" rx="16" fill="#FFFFFF" stroke="#059669" stroke-width="5" filter="url(#dropGlow)"/>
          <text x="-70" y="-100" font-family="'Outfit', sans-serif" font-size="40" font-weight="900" fill="#111111">J</text>
          <text x="-70" y="-60" font-family="'Outfit', sans-serif" font-size="32" fill="#111111">♣</text>
          <text x="0" y="30" font-family="'Outfit', sans-serif" font-size="80" fill="#111111" text-anchor="middle">♣</text>
        </g>

        <!-- 21 Badge Banner -->
        <g transform="translate(0, 220)">
          <rect x="-160" y="-40" width="320" height="80" rx="40" fill="url(#goldGradient)" stroke="#FFFFFF" stroke-width="3" filter="url(#dropGlow)"/>
          <text x="0" y="16" font-family="'Outfit', sans-serif" font-size="44" font-weight="900" fill="#03170e" text-anchor="middle">BLACKJACK 21</text>
        </g>
      </g>
    `
  },
  {
    slug: 'andar-bahar',
    name: 'Andar Bahar Live',
    category: 'Andar Bahar',
    categorySlug: 'andar-bahar',
    provider: 'WinDaq Live',
    variant: 'Speed Dealing',
    themeColor: '#9333EA',
    secondaryColor: '#3B82F6',
    bgGradient: ['#1c0a29', '#2e0f45', '#451666'],
    badge: '50/50 LIVE DEALER',
    tag: 'ANDAR BAHAR',
    rtp: '95.0%',
    minBet: '₹10',
    maxPayout: '2x',
    accentSvg: `
      <!-- Andar Bahar Split Table -->
      <g transform="translate(500, 480)">
        <!-- Center Joker Card -->
        <g transform="translate(0, -90)">
          <rect x="-90" y="-135" width="180" height="270" rx="14" fill="#FFFFFF" stroke="#F59E0B" stroke-width="6" filter="url(#dropGlow)"/>
          <text x="-65" y="-90" font-family="'Outfit', sans-serif" font-size="34" font-weight="900" fill="#E11D48">K</text>
          <text x="-65" y="-55" font-family="'Outfit', sans-serif" font-size="30" fill="#E11D48">♥</text>
          <text x="0" y="25" font-family="'Outfit', sans-serif" font-size="70" fill="#E11D48" text-anchor="middle">♥</text>
          <rect x="-70" y="80" width="140" height="26" rx="13" fill="#F59E0B"/>
          <text x="0" y="98" font-family="'Outfit', sans-serif" font-size="16" font-weight="900" fill="#1a0a24" text-anchor="middle">JOKER</text>
        </g>

        <!-- Andar Box (Left - Blue) -->
        <g transform="translate(-230, 140)">
          <rect x="-140" y="-70" width="280" height="140" rx="20" fill="#1E3A8A" stroke="#3B82F6" stroke-width="5" filter="url(#dropGlow)"/>
          <text x="0" y="-15" font-family="'Outfit', sans-serif" font-size="32" font-weight="900" fill="#FFFFFF" text-anchor="middle">ANDAR</text>
          <text x="0" y="30" font-family="'Outfit', sans-serif" font-size="20" font-weight="700" fill="#93C5FD" text-anchor="middle">1 : 0.90</text>
        </g>

        <!-- Bahar Box (Right - Purple/Pink) -->
        <g transform="translate(230, 140)">
          <rect x="-140" y="-70" width="280" height="140" rx="20" fill="#701A75" stroke="#EC4899" stroke-width="5" filter="url(#dropGlow)"/>
          <text x="0" y="-15" font-family="'Outfit', sans-serif" font-size="32" font-weight="900" fill="#FFFFFF" text-anchor="middle">BAHAR</text>
          <text x="0" y="30" font-family="'Outfit', sans-serif" font-size="20" font-weight="700" fill="#FBCFE8" text-anchor="middle">1 : 1.00</text>
        </g>
      </g>
    `
  },
  {
    slug: 'dragon-tiger',
    name: 'Dragon Tiger',
    category: 'Dragon Tiger',
    categorySlug: 'dragon-tiger',
    provider: 'WinDaq Live',
    variant: 'Speed Baccarat',
    themeColor: '#EA580C',
    secondaryColor: '#0284C7',
    bgGradient: ['#1c0f06', '#2e1809', '#47230b'],
    badge: 'TIE PAYS 11:1',
    tag: 'DRAGON TIGER',
    rtp: '96.27%',
    minBet: '₹10',
    maxPayout: '11x',
    accentSvg: `
      <!-- Dragon vs Tiger Duel Table -->
      <g transform="translate(500, 480)">
        <!-- Dragon side (Left - Red) -->
        <g transform="translate(-220, 0)">
          <rect x="-150" y="-180" width="300" height="360" rx="24" fill="#7C2D12" stroke="#EA580C" stroke-width="6" filter="url(#dropGlow)"/>
          <text x="0" y="-80" font-family="'Outfit', sans-serif" font-size="90" text-anchor="middle">🐉</text>
          <text x="0" y="30" font-family="'Outfit', sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle">DRAGON</text>
          <rect x="-80" y="70" width="160" height="40" rx="20" fill="#EA580C"/>
          <text x="0" y="96" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#FFFFFF" text-anchor="middle">1 : 1</text>
        </g>

        <!-- Tiger side (Right - Cyan/Blue) -->
        <g transform="translate(220, 0)">
          <rect x="-150" y="-180" width="300" height="360" rx="24" fill="#0C4A6E" stroke="#0284C7" stroke-width="6" filter="url(#dropGlow)"/>
          <text x="0" y="-80" font-family="'Outfit', sans-serif" font-size="90" text-anchor="middle">🐅</text>
          <text x="0" y="30" font-family="'Outfit', sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle">TIGER</text>
          <rect x="-80" y="70" width="160" height="40" rx="20" fill="#0284C7"/>
          <text x="0" y="96" font-family="'Outfit', sans-serif" font-size="20" font-weight="900" fill="#FFFFFF" text-anchor="middle">1 : 1</text>
        </g>

        <!-- Center Tie Emblem -->
        <circle cx="0" cy="0" r="85" fill="#10B981" stroke="#FFFFFF" stroke-width="5" filter="url(#dropGlow)"/>
        <text x="0" y="-10" font-family="'Outfit', sans-serif" font-size="30" font-weight="900" fill="#FFFFFF" text-anchor="middle">TIE</text>
        <text x="0" y="25" font-family="'Outfit', sans-serif" font-size="24" font-weight="900" fill="#FFFFFF" text-anchor="middle">11:1</text>
      </g>
    `
  },
  {
    slug: 'dice',
    name: 'Sic Bo Classic',
    category: 'Dice',
    categorySlug: 'dice',
    provider: 'WinDaq Originals',
    variant: '3-Dice Macau',
    themeColor: '#CA8A04',
    secondaryColor: '#DC2626',
    bgGradient: ['#1c1404', '#2e2107', '#45320a'],
    badge: 'TRIPLE 180x',
    tag: 'DICE',
    rtp: '97.2%',
    minBet: '₹10',
    maxPayout: '180x',
    accentSvg: `
      <!-- 3 Macau Red/Gold Dice Tumbling -->
      <g transform="translate(500, 480)">
        <!-- Crystal Dome Glow -->
        <circle cx="0" cy="0" r="320" fill="#140d02" stroke="#CA8A04" stroke-width="6" opacity="0.5"/>
        
        <!-- Die 1 (Left - Value 4) -->
        <g transform="translate(-150, -40) rotate(-22)">
          <rect x="-70" y="-70" width="140" height="140" rx="24" fill="#DC2626" stroke="#FEF08A" stroke-width="5" filter="url(#dropGlow)"/>
          <circle cx="-35" cy="-35" r="12" fill="#FFFFFF"/>
          <circle cx="35" cy="-35" r="12" fill="#FFFFFF"/>
          <circle cx="-35" cy="35" r="12" fill="#FFFFFF"/>
          <circle cx="35" cy="35" r="12" fill="#FFFFFF"/>
        </g>

        <!-- Die 2 (Center - Value 6) -->
        <g transform="translate(0, 30)">
          <rect x="-75" y="-75" width="150" height="150" rx="26" fill="#DC2626" stroke="#FEF08A" stroke-width="6" filter="url(#dropGlow)"/>
          <circle cx="-38" cy="-45" r="13" fill="#FFFFFF"/>
          <circle cx="-38" cy="0" r="13" fill="#FFFFFF"/>
          <circle cx="-38" cy="45" r="13" fill="#FFFFFF"/>
          <circle cx="38" cy="-45" r="13" fill="#FFFFFF"/>
          <circle cx="38" cy="0" r="13" fill="#FFFFFF"/>
          <circle cx="38" cy="45" r="13" fill="#FFFFFF"/>
        </g>

        <!-- Die 3 (Right - Value 5) -->
        <g transform="translate(150, -50) rotate(18)">
          <rect x="-70" y="-70" width="140" height="140" rx="24" fill="#DC2626" stroke="#FEF08A" stroke-width="5" filter="url(#dropGlow)"/>
          <circle cx="-35" cy="-35" r="12" fill="#FFFFFF"/>
          <circle cx="35" cy="-35" r="12" fill="#FFFFFF"/>
          <circle cx="0" cy="0" r="14" fill="#FFFFFF"/>
          <circle cx="-35" cy="35" r="12" fill="#FFFFFF"/>
          <circle cx="35" cy="35" r="12" fill="#FFFFFF"/>
        </g>

        <!-- Big / Small Banner -->
        <rect x="-220" y="190" width="440" height="70" rx="35" fill="url(#goldGradient)" stroke="#FFFFFF" stroke-width="3"/>
        <text x="0" y="236" font-family="'Outfit', sans-serif" font-size="30" font-weight="900" fill="#1c1404" text-anchor="middle">TOTAL: 15 (BIG) 1:1</text>
      </g>
    `
  },
  {
    slug: 'table-games',
    name: 'VIP Table Games',
    category: 'Table',
    categorySlug: 'table',
    provider: 'WinDaq VIP',
    variant: 'High Limit Saloon',
    themeColor: '#0284C7',
    secondaryColor: '#10B981',
    bgGradient: ['#081726', '#0e2740', '#15395c'],
    badge: 'VIP SALOON',
    tag: 'TABLE',
    rtp: '98.0%',
    minBet: '₹100',
    maxPayout: 'Unlimited',
    accentSvg: `
      <!-- Table Games Composite: Cards, Dice & Chips -->
      <g transform="translate(500, 480)">
        <!-- Felt oval -->
        <ellipse cx="0" cy="0" rx="420" ry="260" fill="#0b2036" stroke="#0284C7" stroke-width="6" filter="url(#dropGlow)"/>
        
        <!-- Fanned cards -->
        <g transform="translate(-100, -50) rotate(-14)">
          <rect x="-60" y="-90" width="120" height="180" rx="10" fill="#FFFFFF" stroke="#0284C7" stroke-width="4"/>
          <text x="-40" y="-55" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" fill="#E11D48">K</text>
          <text x="0" y="20" font-family="'Outfit', sans-serif" font-size="50" fill="#E11D48" text-anchor="middle">♦</text>
        </g>
        <g transform="translate(40, -60) rotate(10)">
          <rect x="-60" y="-90" width="120" height="180" rx="10" fill="#FFFFFF" stroke="#10B981" stroke-width="4"/>
          <text x="-40" y="-55" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" fill="#111111">A</text>
          <text x="0" y="20" font-family="'Outfit', sans-serif" font-size="50" fill="#111111" text-anchor="middle">♠</text>
        </g>

        <!-- Golden Roulette ball & Dice -->
        <g transform="translate(180, 60)">
          <rect x="-40" y="-40" width="80" height="80" rx="14" fill="#E11D48" stroke="#FFFFFF" stroke-width="3"/>
          <circle cx="-18" cy="-18" r="7" fill="#FFFFFF"/>
          <circle cx="0" cy="0" r="7" fill="#FFFFFF"/>
          <circle cx="18" cy="18" r="7" fill="#FFFFFF"/>
        </g>

        <!-- VIP Saloon badge -->
        <rect x="-180" y="160" width="360" height="70" rx="35" fill="url(#goldGradient)" stroke="#0284C7" stroke-width="3"/>
        <text x="0" y="206" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" fill="#081726" text-anchor="middle">HIGH ROLLER VIP</text>
      </g>
    `
  },
  {
    slug: 'trending',
    name: 'Hot & Trending',
    category: 'Hot Games',
    categorySlug: 'hot',
    provider: 'WinDaq Network',
    variant: 'Player Favorites',
    themeColor: '#EF4444',
    secondaryColor: '#F59E0B',
    bgGradient: ['#210606', '#3b0b0b', '#591010'],
    badge: 'MOST POPULAR',
    tag: 'HOT GAMES',
    rtp: '97.8%',
    minBet: '₹10',
    maxPayout: '50,000x',
    accentSvg: `
      <!-- Flame Emblem & Trophy -->
      <g transform="translate(500, 480)">
        <!-- Fire aura circles -->
        <circle cx="0" cy="0" r="300" fill="#290707" stroke="#EF4444" stroke-width="6" opacity="0.6"/>
        
        <!-- Big Flame SVG -->
        <g transform="translate(0, -60) scale(1.8)">
          <path d="M 0 -80 Q 40 -20 20 40 Q 60 -10 30 70 Q 0 90 -30 70 Q -60 -10 -20 40 Q -40 -20 0 -80 Z" fill="url(#goldGradient)" filter="url(#dropGlow)"/>
          <path d="M 0 -40 Q 25 -10 10 30 Q 30 0 15 50 Q 0 65 -15 50 Q -30 0 -10 30 Q -25 -10 0 -40 Z" fill="#EF4444"/>
        </g>

        <!-- Trophy Base -->
        <g transform="translate(0, 160)">
          <rect x="-180" y="-35" width="360" height="70" rx="35" fill="#EF4444" stroke="#FFFFFF" stroke-width="3"/>
          <text x="0" y="10" font-family="'Outfit', sans-serif" font-size="26" font-weight="900" fill="#FFFFFF" text-anchor="middle">🔥 TOP 10 PLAYED TODAY</text>
        </g>
      </g>
    `
  },
  {
    slug: 'sportsbook',
    name: 'Cricket Sportsbook',
    category: 'Sports',
    categorySlug: 'sports',
    provider: 'WinDaq Sports',
    variant: 'IPL & World Cup',
    themeColor: '#10B981',
    secondaryColor: '#0284C7',
    bgGradient: ['#041c14', '#083324', '#0d4f37'],
    badge: 'LIVE MATCH ODDS',
    tag: 'SPORTS',
    rtp: '96.0%',
    minBet: '₹50',
    maxPayout: '₹10,00,000',
    accentSvg: `
      <!-- Cricket Stadium & Equipment -->
      <g transform="translate(500, 480)">
        <!-- Stadium Floodlight Ring -->
        <ellipse cx="0" cy="0" rx="420" ry="240" fill="#072b1e" stroke="#10B981" stroke-width="8" filter="url(#dropGlow)"/>
        
        <!-- Cricket Pitch Strip -->
        <rect x="-60" y="-160" width="120" height="320" rx="10" fill="#78350F" stroke="#F59E0B" stroke-width="3"/>
        
        <!-- Wickets -->
        <g transform="translate(0, -120)">
          <line x1="-24" y1="0" x2="-24" y2="40" stroke="#FFFFFF" stroke-width="5"/>
          <line x1="0" y1="0" x2="0" y2="40" stroke="#FFFFFF" stroke-width="5"/>
          <line x1="24" y1="0" x2="24" y2="40" stroke="#FFFFFF" stroke-width="5"/>
          <line x1="-28" y1="0" x2="28" y2="0" stroke="#F59E0B" stroke-width="6"/>
        </g>

        <!-- Red Cricket Ball with white seam -->
        <g transform="translate(180, 0)">
          <circle cx="0" cy="0" r="75" fill="#DC2626" stroke="#7F1D1D" stroke-width="4" filter="url(#dropGlow)"/>
          <path d="M -50 -50 Q 0 0 50 50" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="6,4"/>
          <circle cx="-25" cy="-25" r="20" fill="#FFFFFF" opacity="0.25"/>
        </g>

        <!-- Crossed Cricket Bats -->
        <g transform="translate(-160, 0) rotate(35)">
          <rect x="-14" y="-120" width="28" height="240" rx="10" fill="#F59E0B" stroke="#78350F" stroke-width="3"/>
          <rect x="-8" y="-160" width="16" height="50" rx="6" fill="#111111"/>
        </g>

        <!-- Live Score Odds Banner -->
        <rect x="-240" y="170" width="480" height="74" rx="37" fill="#0284C7" stroke="#10B981" stroke-width="3"/>
        <text x="0" y="217" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" fill="#FFFFFF" text-anchor="middle">IND vs AUS • 1.95 LIVE</text>
      </g>
    `
  },
  {
    slug: 'lightning-roulette',
    name: 'Lightning Roulette',
    category: 'Roulette',
    categorySlug: 'roulette',
    provider: 'Evolution & WinDaq',
    variant: '500x Multiplier',
    themeColor: '#EAB308',
    secondaryColor: '#A855F7',
    bgGradient: ['#1c1303', '#332306', '#4a330a'],
    badge: '500x LIGHTNING',
    tag: 'ROULETTE',
    rtp: '97.3%',
    minBet: '₹20',
    maxPayout: '500x',
    accentSvg: `
      <!-- Lightning Roulette with Bolts & Multiplier Numbers -->
      <g transform="translate(500, 480)">
        <circle cx="0" cy="0" r="320" fill="#170f03" stroke="#EAB308" stroke-width="8" filter="url(#dropGlow)"/>
        
        <!-- Lightning bolts -->
        <polygon points="0,-260 -40,-60 20,-60 -20,180 80,-10 20,-10 60,-260" fill="#EAB308" filter="url(#dropGlow)"/>
        
        <!-- 500x Multiplier Lucky Number -->
        <rect x="-140" y="-60" width="280" height="120" rx="24" fill="#7E22CE" stroke="#EAB308" stroke-width="5"/>
        <text x="0" y="24" font-family="'Outfit', sans-serif" font-size="70" font-weight="900" fill="#FFFFFF" text-anchor="middle">500x</text>
        
        <!-- Lucky number 17 -->
        <circle cx="0" cy="170" r="50" fill="#DC2626" stroke="#FFFFFF" stroke-width="4"/>
        <text x="0" y="186" font-family="'Outfit', sans-serif" font-size="44" font-weight="900" fill="#FFFFFF" text-anchor="middle">17</text>
      </g>
    `
  },
  {
    slug: 'live-casino',
    name: 'Live Dealer Studio',
    category: 'Hot Games',
    categorySlug: 'hot',
    provider: 'WinDaq VIP Live',
    variant: '24/7 VIP HD',
    themeColor: '#00FFA3',
    secondaryColor: '#E11D48',
    bgGradient: ['#071a17', '#0c302a', '#14473e'],
    badge: 'LIVE 24/7 STREAM',
    tag: 'LIVE CASINO',
    rtp: '98.5%',
    minBet: '₹100',
    maxPayout: 'VIP Limit',
    accentSvg: `
      <!-- Live Dealer Studio Camera & Stage -->
      <g transform="translate(500, 480)">
        <ellipse cx="0" cy="0" rx="420" ry="250" fill="#092420" stroke="#00FFA3" stroke-width="6" filter="url(#dropGlow)"/>
        
        <!-- Live stream broadcast badge -->
        <g transform="translate(0, -120)">
          <rect x="-90" y="-30" width="180" height="60" rx="30" fill="#DC2626" stroke="#FFFFFF" stroke-width="3"/>
          <circle cx="-50" cy="0" r="8" fill="#FFFFFF"/>
          <text x="10" y="10" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" fill="#FFFFFF" text-anchor="middle">LIVE HD</text>
        </g>

        <!-- Dealer Cards -->
        <g transform="translate(-80, 40) rotate(-8)">
          <rect x="-55" y="-80" width="110" height="160" rx="10" fill="#FFFFFF" stroke="#00FFA3" stroke-width="4"/>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="40" fill="#DC2626" text-anchor="middle">♥ A</text>
        </g>
        <g transform="translate(80, 40) rotate(8)">
          <rect x="-55" y="-80" width="110" height="160" rx="10" fill="#FFFFFF" stroke="#00FFA3" stroke-width="4"/>
          <text x="0" y="15" font-family="'Outfit', sans-serif" font-size="40" fill="#111111" text-anchor="middle">♠ K</text>
        </g>

        <!-- Studio watermark -->
        <rect x="-180" y="160" width="360" height="60" rx="30" fill="#00FFA3"/>
        <text x="0" y="200" font-family="'Outfit', sans-serif" font-size="24" font-weight="900" fill="#071a17" text-anchor="middle">WINDAQ VIP DEALER</text>
      </g>
    `
  }
];

function generateSvgArtwork(game, width, height, type = 'card') {
  const isHero = type === 'hero';
  const isMobile = type === 'mobile';
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <!-- Background Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${game.bgGradient[0]}"/>
      <stop offset="50%" stop-color="${game.bgGradient[1]}"/>
      <stop offset="100%" stop-color="${game.bgGradient[2]}"/>
    </linearGradient>
    <linearGradient id="curveGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${game.themeColor}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${game.themeColor}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF176"/>
      <stop offset="50%" stop-color="#FFD700"/>
      <stop offset="100%" stop-color="#FFA000"/>
    </linearGradient>
    <radialGradient id="neonCenterGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${game.themeColor}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${game.themeColor}" stop-opacity="0.1"/>
    </radialGradient>
    <radialGradient id="ballGold" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFF59D"/>
      <stop offset="50%" stop-color="#FBC02D"/>
      <stop offset="100%" stop-color="#F57F17"/>
    </radialGradient>
    <radialGradient id="ballRed" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FF8A80"/>
      <stop offset="50%" stop-color="#E53935"/>
      <stop offset="100%" stop-color="#B71C1C"/>
    </radialGradient>
    <radialGradient id="ballGreen" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#B9F6CA"/>
      <stop offset="50%" stop-color="#00E676"/>
      <stop offset="100%" stop-color="#00A854"/>
    </radialGradient>
    <radialGradient id="ballBlue" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#80D8FF"/>
      <stop offset="50%" stop-color="#00B0FF"/>
      <stop offset="100%" stop-color="#0091EA"/>
    </radialGradient>
    <radialGradient id="ballPurple" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#EA80FC"/>
      <stop offset="50%" stop-color="#AA00FF"/>
      <stop offset="100%" stop-color="#6A0080"/>
    </radialGradient>

    <!-- Filters -->
    <filter id="dropGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="1000" height="1000" fill="url(#bgGrad)"/>
  
  <!-- Subtle Ambient Glow -->
  <circle cx="500" cy="500" r="450" fill="${game.themeColor}" opacity="0.08" filter="url(#dropGlow)"/>

  <!-- Geometric Grid Texture -->
  <g stroke="#FFFFFF" stroke-width="1" opacity="0.04">
    <line x1="100" y1="0" x2="100" y2="1000"/>
    <line x1="300" y1="0" x2="300" y2="1000"/>
    <line x1="500" y1="0" x2="500" y2="1000"/>
    <line x1="700" y1="0" x2="700" y2="1000"/>
    <line x1="900" y1="0" x2="900" y2="1000"/>
    <line x1="0" y1="200" x2="1000" y2="200"/>
    <line x1="0" y1="400" x2="1000" y2="400"/>
    <line x1="0" y1="600" x2="1000" y2="600"/>
    <line x1="0" y1="800" x2="1000" y2="800"/>
  </g>

  <!-- Game Specific Artwork Core -->
  ${game.accentSvg}
</svg>`;
}

// Write out all SVG files to public/artwork/games/
console.log('🎨 Generating Original WinDaq Artwork SVGs...');

const artworkRegistry = {};

for (const game of gamesList) {
  const heroSvg = generateSvgArtwork(game, 1920, 1080, 'hero');
  const cardSvg = generateSvgArtwork(game, 800, 1000, 'card');
  const mobileSvg = generateSvgArtwork(game, 600, 600, 'mobile');
  const fallbackSvg = generateSvgArtwork(game, 400, 500, 'card');

  // File paths
  const heroPath = path.join(OUTPUT_DIR, `${game.slug}-hero.svg`);
  const cardPath = path.join(OUTPUT_DIR, `${game.slug}-card.svg`);
  const mobilePath = path.join(OUTPUT_DIR, `${game.slug}-mobile.svg`);

  // Root public duplicates for direct access
  const rootHeroPath = path.join(ROOT_OUTPUT_DIR, `${game.slug}-hero.svg`);
  const rootCardPath = path.join(ROOT_OUTPUT_DIR, `${game.slug}-card.svg`);
  const rootMobilePath = path.join(ROOT_OUTPUT_DIR, `${game.slug}-mobile.svg`);

  fs.writeFileSync(heroPath, heroSvg);
  fs.writeFileSync(cardPath, cardSvg);
  fs.writeFileSync(mobilePath, mobileSvg);

  fs.writeFileSync(rootHeroPath, heroSvg);
  fs.writeFileSync(rootCardPath, cardSvg);
  fs.writeFileSync(rootMobilePath, mobileSvg);

  // Convert fallback to data URI for zero-network instantaneous fallback
  const fallbackDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;

  artworkRegistry[game.slug] = {
    slug: game.slug,
    name: game.name,
    category: game.category,
    categorySlug: game.categorySlug,
    provider: game.provider,
    variant: game.variant,
    themeColor: game.themeColor,
    secondaryColor: game.secondaryColor,
    badge: game.badge,
    tag: game.tag,
    rtp: game.rtp,
    minBet: game.minBet,
    maxPayout: game.maxPayout,
    heroImage: `/artwork/games/${game.slug}-hero.svg`,
    cardImage: `/artwork/games/${game.slug}-card.svg`,
    mobileImage: `/artwork/games/${game.slug}-mobile.svg`,
    fallbackImage: fallbackDataUri
  };
}

console.log(`✅ Generated ${gamesList.length * 3} SVG artwork assets.`);

// Generate apps/web/src/lib/gameArtwork.ts
const tsContent = `/**
 * WinDaq Original Artwork Registry
 * Auto-generated with bespoke vector artwork for all 16 games.
 * Guarantees zero broken/black images via bulletproof fallback SVGs.
 */

export interface GameArtworkMetadata {
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  provider: string;
  variant: string;
  themeColor: string;
  secondaryColor: string;
  badge: string;
  tag: string;
  rtp: string;
  minBet: string;
  maxPayout: string;
  heroImage: string;
  cardImage: string;
  mobileImage: string;
  fallbackImage: string;
}

export const GAME_ARTWORK: Record<string, GameArtworkMetadata> = ${JSON.stringify(artworkRegistry, null, 2)};

export function getGameArtwork(slug: string): GameArtworkMetadata {
  if (GAME_ARTWORK[slug]) {
    return GAME_ARTWORK[slug];
  }
  
  // Default WinDaq fallback
  return {
    slug,
    name: slug.replace(/-/g, ' ').toUpperCase(),
    category: 'Casino',
    categorySlug: 'casino',
    provider: 'WinDaq Originals',
    variant: 'Classic',
    themeColor: '#00FFA3',
    secondaryColor: '#0A2540',
    badge: 'WINDAQ ORIGINAL',
    tag: 'CASINO',
    rtp: '97.0%',
    minBet: '₹10',
    maxPayout: '10,000x',
    heroImage: '/artwork/games/aviator-hero.svg',
    cardImage: '/artwork/games/aviator-card.svg',
    mobileImage: '/artwork/games/aviator-mobile.svg',
    fallbackImage: GAME_ARTWORK['aviator']?.fallbackImage || ''
  };
}

export const LOBBY_CATEGORIES = [
  { slug: 'all', name: 'All Games', icon: 'Sparkles' },
  { slug: 'favorites', name: 'Favorites', icon: 'Star' },
  { slug: 'crash', name: 'Crash', icon: 'TrendingUp' },
  { slug: 'colour', name: 'Colour', icon: 'Palette' },
  { slug: 'slots', name: 'Slots', icon: 'Gamepad2' },
  { slug: 'scratch', name: 'Scratch', icon: 'Coins' },
  { slug: 'lotto', name: 'Lotto', icon: 'Ticket' },
  { slug: 'teen-patti', name: 'Teen Patti', icon: 'Crown' },
  { slug: 'poker', name: 'Poker', icon: 'Club' },
  { slug: 'rummy', name: 'Rummy', icon: 'Layers' },
  { slug: 'roulette', name: 'Roulette', icon: 'CircleDot' },
  { slug: 'blackjack', name: 'Blackjack', icon: 'ShieldCheck' },
  { slug: 'andar-bahar', name: 'Andar Bahar', icon: 'Flame' },
  { slug: 'dragon-tiger', name: 'Dragon Tiger', icon: 'Zap' },
  { slug: 'dice', name: 'Dice', icon: 'Dices' },
  { slug: 'table', name: 'Table', icon: 'LayoutGrid' },
  { slug: 'hot', name: 'Hot Games', icon: 'Fire' },
  { slug: 'sports', name: 'Sports', icon: 'Trophy' }
] as const;
`;

fs.writeFileSync(LIB_FILE, tsContent);
console.log('✅ Generated apps/web/src/lib/gameArtwork.ts');
