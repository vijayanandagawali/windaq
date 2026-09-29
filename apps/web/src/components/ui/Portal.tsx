'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribe = () => () => {};

/**
 * Renders children into document.body so full-screen overlays sit above the sticky header
 * (page wrappers create their own stacking context, which would trap `position: fixed` + z-index).
 */
export default function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}
