import { useEffect, useState } from 'react';

export type ViewportMode = 'desktop' | 'mobile-portrait' | 'mobile-landscape';

export function detectViewportMode(width: number, height: number): ViewportMode {
  if (width >= 900 && height >= 600) {
    return 'desktop';
  }
  return width > height ? 'mobile-landscape' : 'mobile-portrait';
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() =>
    typeof window === 'undefined'
      ? 'desktop'
      : detectViewportMode(window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    const update = () => {
      setMode(detectViewportMode(window.innerWidth, window.innerHeight));
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return mode;
}
