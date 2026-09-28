/** Games with a live animated lobby preview. Plain module so server components can use it too. */
export const PREVIEW_SLUGS = new Set([
  'european-roulette', 'dice', 'dragon-tiger', 'andar-bahar', 'blackjack',
  'aviator', 'colour-prediction', 'lotto', 'slots', 'scratch'
]);

export function hasPreview(slug: string) {
  return PREVIEW_SLUGS.has(slug);
}
