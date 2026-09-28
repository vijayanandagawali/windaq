import { redirect } from 'next/navigation';
import GameComingSoon from '@/components/lobby/GameComingSoon';
import { findGame } from '@/lib/games';

// Unknown or legacy game URLs: send live games to their page, everything else to a clear notice.
export default async function GameFallbackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = findGame(slug);
  if (game?.status === 'live') redirect(game.href);
  return <GameComingSoon slug={game ? slug : undefined} title={game ? undefined : 'Game not found'} />;
}
