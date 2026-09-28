import Link from 'next/link';
import { Lock, Play } from 'lucide-react';
import type { LobbyGame } from '@/lib/games';
import GamePreview from './previews/GamePreviews';
import { hasPreview } from './previews/slugs';

/**
 * Lobby game tile. The artwork is a plain <img>: it is visible as soon as it paints, with no
 * JS-driven fade that could leave an empty box when the load event fires before hydration.
 */
export default function GameTile({ game, priority = false }: { game: LobbyGame; priority?: boolean }) {
  const comingSoon = game.status === 'coming-soon';

  const body = (
    <>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-slate-100 ring-1 ring-slate-200/80 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_22px_44px_-12px_var(--tile-glow)] group-focus-visible:ring-2 group-focus-visible:ring-emerald-500"
        style={{ ['--tile-glow' as string]: `${game.accent}66`, boxShadow: '0 8px 24px -10px rgba(15,23,42,0.18)' }}>
        {!comingSoon && hasPreview(game.slug) ? (
          <div className="h-full w-full transition duration-500 group-hover:scale-[1.04]"><GamePreview slug={game.slug} /></div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.cardImage}
            alt=""
            width={400}
            height={500}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.06] ${comingSoon ? 'grayscale opacity-60' : ''}`}
          />
        )}
        {(comingSoon || !hasPreview(game.slug)) && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />}

        {comingSoon ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm backdrop-blur">
            <Lock size={10} aria-hidden="true" /> Coming soon
          </span>
        ) : (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-sm backdrop-blur"
            style={{ color: game.accent }}>
            {game.highlight}
          </span>
        )}

        {!comingSoon && (
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="flex h-14 w-14 scale-75 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.3)] transition duration-300 group-hover:scale-100">
              <Play size={22} fill="currentColor" className="ml-0.5" aria-hidden="true" />
            </span>
          </span>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-bold text-slate-900 sm:text-[15px]">{game.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{game.tagline}</p>
        {!comingSoon && <p className="mt-1 text-[11px] font-bold text-emerald-600">From ₹{game.minBet}</p>}
      </div>
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
    <Link href={game.href} className="press group block rounded-[22px] outline-none transition-[scale] duration-150" aria-label={`Play ${game.name}`}>
      {body}
    </Link>
  );
}
