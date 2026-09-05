import { VARIANTS } from '@/lib/variants';
import type { GameVariant } from '@/types/game';

interface VariantSelectorProps {
  readonly current: GameVariant;
  readonly onChange: (v: GameVariant) => void;
  readonly locked?: boolean;
}

export function VariantSelector({ current, onChange, locked }: VariantSelectorProps) {
  return (
    <select
      className="rounded border border-bingo-muted bg-bingo-surface px-4 py-2 text-xl text-bingo-text"
      value={current}
      disabled={locked}
      onChange={(e) => onChange(e.target.value as GameVariant)}
    >
      {Object.values(VARIANTS).map((v) => (
        <option key={v.name} value={v.name}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
