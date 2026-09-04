'use client';

import { useState, useCallback } from 'react';
import { Printer } from 'lucide-react';
import type { GameVariant } from '@/types/game';
import { FREE_SPACE, generate75BallCard, generate90BallCard } from '@/lib/generateCard';

const FREE_CELL = FREE_SPACE;

function CardGrid75({ cards }: { readonly cards: number[][][] }) {
  return (
    <div id="print-area" className="space-y-8 p-6">
      {cards.map((card, ci) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={`75-card-${ci}`} className="mx-auto w-fit rounded border-2 border-black bg-white p-4 text-black">
          {/* Column headers */}
          <div className="mb-2 flex justify-between px-4 text-3xl font-bold tracking-widest text-bingo-bg">
            {['B', 'I', 'N', 'G', 'O'].map((letter) => (
              <span key={letter} className="w-16 text-center">{letter}</span>
            ))}
          </div>
          {/* Grid */}
          <div className="grid grid-cols-5 gap-0 border border-black">
            {card.flat().map((cell, i) => (
              <span
                key={`${ci}-${i}`}
                className={`flex h-16 w-16 items-center justify-center border-r border-b border-black text-2xl font-bold ${
                  cell === FREE_CELL ? 'bg-yellow-200' : ''
                }`}
              >
                {cell === FREE_CELL ? '★' : String(cell)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardGrid90({ cards }: { readonly cards: any[] }) {
  return (
    <div id="print-area" className="space-y-8 p-6">
      {cards.map((card, ci) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={`90-card-${ci}`} className="mx-auto w-fit rounded border-2 border-black bg-white p-4 text-black">
          {/* Grid */}
          <div className="grid grid-cols-9 gap-0 border border-black">
            {(card as any[]).map((cell: { row: number[]; blanks: boolean[] }, rowIndex: number) =>
              cell.row.map((num, colIndex: number) => (
                cell.blanks[colIndex] ? (
                  <span key={`${ci}-${rowIndex}-${colIndex}`} className="flex h-12 w-14 items-center justify-center border-r border-b border-black" />
                ) : (
                  <span key={`${ci}-${rowIndex}-${colIndex}`} className="flex h-12 w-14 items-center justify-center border-r border-b border-black text-xl font-bold">
                    {num}
                  </span>
                )
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlayerCardPage() {
  const [variant, setVariant] = useState<GameVariant>('90-ball');
  const [cardCount, setCardCount] = useState(6);

  const cards75 = useCallback(
    () => Array.from({ length: cardCount }, () => generate75BallCard()),
    [cardCount],
  );
  const cards90 = useCallback(
    () => Array.from({ length: cardCount }, () => generate90BallCard()),
    [cardCount],
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center bg-bingo-bg">
      {/* Controls */}
      <div className="flex w-full items-center justify-center gap-4 bg-bingo-surface p-4">
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as GameVariant)}
          className="rounded border border-white/20 bg-bingo-bg px-4 py-2 text-xl text-white"
        >
          <option value="90-ball">90-ball</option>
          <option value="75-ball">75-ball</option>
        </select>

        <select
          value={cardCount}
          onChange={(e) => setCardCount(Number(e.target.value))}
          className="rounded border border-white/20 bg-bingo-bg px-4 py-2 text-xl text-white"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>{n} card{n > 1 ? 's' : ''}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-bingo-accent px-6 py-2 text-lg font-bold text-bingo-bg hover:opacity-90"
        >
          <Printer className="h-5 w-5" />
          Print
        </button>
      </div>

      {/* Card display */}
      <div className="flex-1 overflow-auto">
        {variant === '75-ball' ? (
          <CardGrid75 cards={cards75()} />
        ) : (
          <CardGrid90 cards={cards90()} />
        )}
      </div>

      {/* Footer */}
      <p className="w-full bg-bingo-surface px-6 py-2 text-center text-sm text-bingo-muted">
        {variant} Bingo — Printed {new Date().toLocaleDateString()}
      </p>
    </div>
  );
}
