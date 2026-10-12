type Theme = 'light' | 'dark';

/**
 * Switches the colour theme with a circle that grows out of the toggle button
 * (View Transitions API). Falls back to an instant switch when the browser lacks
 * support or the visitor prefers reduced motion.
 */
export function switchThemeWithReveal(next: Theme, setTheme: (theme: Theme) => void, origin?: HTMLElement | null) {
  const doc = document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) {
    setTheme(next);
    return;
  }

  const rect = origin?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : 0;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = doc.startViewTransition(() => {
    // next-themes applies the class in an effect; set it now so the new snapshot is correct.
    const root = document.documentElement;
    root.classList.toggle('dark', next === 'dark');
    root.classList.toggle('light', next === 'light');
    root.style.colorScheme = next;
    setTheme(next);
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 480, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});
}
