import Link from 'next/link';
import { Lock, Play } from 'lucide-react';
import type { LobbyGame } from '@/lib/games';

/**
 * Lobby game tile. The artwork is a plain <img>: it is visible as soon as it paints, with no
 * JS-driven fade that could leave a black box when the load event fires before hydration.
 */
export default function GameTile({ game, priority = false }: { game: LobbyGame; priority?: boolean }) {
  const comingSoon = game.status === 'coming-soon';

  const body = (
    <>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-ocean-surface ring-1 ring-white/10 transition duration-300 group-hover:ring-2 group-focus-visible:ring-2"
        style={{ ['--tile-accent' as string]: game.accent, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.cardImage}
          alt=""
          width={400}
          height={500}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.06] ${comingSoon ? 'grayscale-[60%] opacity-60' : ''}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{ boxShadow: `inset 0 0 0 2px ${game.accent}, 0 0 28px ${game.accent}55` }} />

        {comingSoon ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80 ring-1 ring-white/15">
            <Lock size={10} aria-hidden="true" /> Coming soon
          </span>
        ) : (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/10"
            style={{ color: game.accent }}>
            {game.highlight}
          </span>
        )}

        {!comingSoon && (
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neon-mint text-deep-ocean shadow-[0_0_30px_rgba(38,240,178,0.55)] transition duration-300 group-hover:scale-100 scale-75">
              <Play size={24} fill="currentColor" aria-hidden="true" />
            </span>
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="text-sm font-extrabold leading-tight text-white sm:text-base">{game.name}</h3>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/65 sm:text-xs">{game.tagline}</p>
        </div>
      </div>
      {!comingSoon && (
        <p className="mt-1.5 px-0.5 text-[11px] font-semibold text-white/45">From ₹{game.minBet}</p>
      )}
    </>
  );

  if (comingSoon) {
    return (
      <div className="group cursor-default select-none" aria-label={`${game.name} — coming soon`}>
        {body}
      </div>
    );
  }

  return (
    <Link href={game.href} className="group block rounded-2xl outline-none" aria-label={`Play ${game.name}`}>
      {body}
    </Link>
  );
}
