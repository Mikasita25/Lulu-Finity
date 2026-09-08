import { create } from 'zustand';

// Presentation state only: closing the browser must not destroy its WebView.
export const useBrowserStore = create<{
  open: boolean;
  initialized: boolean;
  playing: boolean;
  title: string;
  show: () => void;
  hide: () => void;
  setPlaying: (playing: boolean, title?: string) => void;
}>((set) => ({
  open: false,
  initialized: false,
  playing: false,
  title: 'YouTube',
  show: () => set({ open: true, initialized: true }),
  hide: () => set({ open: false }),
  setPlaying: (playing, title) => set((state) => ({ playing, title: title || state.title })),
}));
