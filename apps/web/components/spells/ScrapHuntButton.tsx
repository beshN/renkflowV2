'use client';

import { useRef, useState, type ComponentType } from 'react';
import type { ScrapParams, ScrapPart } from '@/lib/features/spells/scrap-hunt';

type GameProps = { parts: ScrapPart[]; params: ScrapParams; fromPlan: boolean; onClose: () => void };
type Loaded = { Game: ComponentType<GameProps>; parts: ScrapPart[]; params: ScrapParams; fromPlan: boolean };

/**
 * The quiet way into "Fire avı" on the cut list. The game, its rules and the engine run it compares
 * with are loaded only when it is opened, so the screen weighs the same as before. `lengths` are the
 * shown plan's pieces (a copy is played; the plan itself is never touched); without them the game
 * draws a random set.
 */
export function ScrapHuntButton({ lengths, parameters, className = '' }: { lengths?: number[]; parameters?: Record<string, unknown> | null; className?: string }) {
  const [game, setGame] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const open = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [{ ScrapHunt }, rules] = await Promise.all([import('./ScrapHunt'), import('@/lib/features/spells/scrap-hunt')]);
      const params = rules.paramsFrom(parameters);
      const fromPlan = (lengths?.filter((l) => rules.canPlace([], l, params)).length ?? 0) >= 2;
      setGame({ Game: ScrapHunt, params, fromPlan, parts: fromPlan ? rules.partsFromPlan(lengths ?? [], params) : rules.randomParts() });
    } catch {
      /* chunk failed to load (offline): the button simply does nothing */
    } finally {
      setLoading(false);
    }
  };
  const close = () => { setGame(null); requestAnimationFrame(() => trigger.current?.focus()); };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={open}
        aria-busy={loading}
        aria-haspopup="dialog"
        title="Parçaları kendiniz yerleştirin, sistemle yarışın"
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className}`}
      >
        Fire avı <span aria-hidden>🪚</span><span className="sr-only">: kesim oyununu aç</span>
      </button>
      {game && <game.Game parts={game.parts} params={game.params} fromPlan={game.fromPlan} onClose={close} />}
    </>
  );
}
