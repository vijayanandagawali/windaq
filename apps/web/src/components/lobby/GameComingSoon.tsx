import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import GameTile from '@/components/lobby/GameTile';
import { LIVE_GAMES, findGame } from '@/lib/games';

/**
 * Shown for games that are not open for real money yet. No bets, no simulated tables.
 */
export default function GameComingSoon({ slug, title }: { slug?: string; title?: string }) {
  const game = slug ? findGame(slug) : undefined;
  const name = title || game?.name || 'This game';
  const suggestions = LIVE_GAMES.filter((g) => g.category === (game?.category === 'crash' ? 'table' : game?.category ?? 'table')).slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="grid items-center gap-8 rounded-[28px] bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6 ring-1 ring-white/10 sm:p-10 md:grid-cols-[220px_1fr]">
        {game && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.cardImage} alt="" width={220} height={275}
            className="mx-auto aspect-[4/5] w-44 rounded-2xl object-cover opacity-80 ring-1 ring-white/15 grayscale-[40%] md:w-full" />
        )}
        <div className={game ? '' : 'md:col-span-2 text-center'}>
          {title !== 'Game not found' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-warning/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-warning ring-1 ring-gold-warning/30">
              <Clock size={12} aria-hidden="true" /> Coming soon
            </span>
          )}
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">{name}</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/65 sm:text-base">
            {game
              ? `We are building ${name} with every round settled by our server. It is not open for play yet — no bets can be placed here. It will appear in the lobby as soon as it is ready.`
              : 'This page is not available right now. Everything that is ready to play is in the lobby.'}
          </p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-neon-mint px-5 py-3 text-sm font-black text-deep-ocean transition hover:bg-neon-mint-hover">
            <ArrowLeft size={16} aria-hidden="true" /> Back to the lobby
          </Link>
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-extrabold text-white">Play now instead</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4">
            {suggestions.map((g) => <GameTile key={g.slug} game={g} />)}
          </div>
        </section>
      )}
    </div>
  );
}
