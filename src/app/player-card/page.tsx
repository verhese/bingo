'use client';

import { useEffect, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import type { GameVariant } from '@/types/game';
import { FREE_SPACE, generate75BallCard, generate90BallCard } from '@/lib/generateCard';

const FREE_CELL = FREE_SPACE;
type Card75 = number[][];
type Card90 = ReturnType<typeof generate90BallCard>;

function create75BallCards(count: number): Card75[] {
  return Array.from({ length: count }, () => generate75BallCard());
}

function create90BallCards(count: number): Card90[] {
  return Array.from({ length: count }, () => generate90BallCard());
}

function CardGrid75({ cards, cardSetName }: { readonly cards: Card75[]; cardSetName: string }) {
  return (
    <div id="print-area" className="space-y-8 p-6">
      {cards.map((card, ci) => (
        // eslint-disable-next-line react/no-array-index-key
        <div data-pdf-card key={`75-card-${ci}`} className="mx-auto w-fit rounded border-2 border-black p-4" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
          {/* Column headers */}
          <div className="mb-2 flex text-3xl font-bold tracking-widest" style={{ color: '#101827' }}>
            {['B', 'I', 'N', 'G', 'O'].map((letter) => (
              <span key={letter} className="w-16 text-center">{letter}</span>
            ))}
          </div>
          {/* Grid */}
          <div className="grid w-fit grid-cols-5 gap-0 border border-black">
            {card.flat().map((cell, i) => (
              <span
                key={`${ci}-${i}`}
                className="flex h-16 w-16 items-center justify-center border-r border-b border-black text-2xl font-bold"
                style={{ backgroundColor: cell === FREE_CELL ? '#fef08a' : '#ffffff' }}
              >
                {cell === FREE_CELL ? '★' : String(cell)}
              </span>
            ))}
          </div>
          {cardSetName && <p className="mt-3 text-center text-lg font-bold" style={{ color: '#94a3b8' }}>{cardSetName}</p>}
        </div>
      ))}
    </div>
  );
}

function CardGrid90({ cards, cardSetName }: { readonly cards: Card90[]; cardSetName: string }) {
  return (
    <div id="print-area" className="space-y-8 p-6">
      {cards.map((card, ci) => (
        // eslint-disable-next-line react/no-array-index-key
        <div data-pdf-card key={`90-card-${ci}`} className="mx-auto w-fit rounded border-2 border-black p-4" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
          {/* Grid */}
          <div className="grid grid-cols-9 gap-0 border border-black">
            {card.map((cell, rowIndex) =>
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
          {cardSetName && <p className="mt-3 text-center text-lg font-bold" style={{ color: '#94a3b8' }}>{cardSetName}</p>}
        </div>
      ))}
    </div>
  );
}

export default function PlayerCardPage() {
  const [variant, setVariant] = useState<GameVariant>('90-ball');
  const [cardCount, setCardCount] = useState(6);
  const [cardSetName, setCardSetName] = useState('');
  const [cards75, setCards75] = useState<Card75[]>([]);
  const [cards90, setCards90] = useState<Card90[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportComplete, setExportComplete] = useState(false);
  const [printedDate, setPrintedDate] = useState('');

  useEffect(() => {
    setCards75(create75BallCards(cardCount));
    setCards90(create90BallCards(cardCount));
    setPrintedDate(new Date().toLocaleDateString());
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleCardCountChange = (count: number) => {
    setCardCount(count);
    setCards75(create75BallCards(count));
    setCards90(create90BallCards(count));
  };

  const handleNewCards = () => {
    if (variant === '75-ball') {
      setCards75(create75BallCards(cardCount));
    } else {
      setCards90(create90BallCards(cardCount));
    }
  };

  const handlePdfExport = async () => {
    const cards = document.querySelectorAll<HTMLElement>('[data-pdf-card]');
    if (!cards.length) return;

    setIsExporting(true);
    setExportError(null);
    setExportComplete(false);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      for (const [index, card] of Array.from(cards).entries()) {
        const canvas = await html2canvas(card, { backgroundColor: '#ffffff', scale: 2 });
        const imageWidth = pageWidth - margin * 2;
        const imageHeight = (canvas.height * imageWidth) / canvas.width;
        const availableHeight = pageHeight - margin * 2;
        const scale = Math.min(1, availableHeight / imageHeight);
        const width = imageWidth * scale;
        const height = imageHeight * scale;

        if (index > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
      }

      pdf.save(`${variant}-bingo-cards.pdf`);
      setExportComplete(true);
    } catch (error) {
      console.error('Unable to export bingo cards as a PDF.', error);
      setExportError('Unable to create the PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
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
          onChange={(e) => handleCardCountChange(Number(e.target.value))}
          className="rounded border border-white/20 bg-bingo-bg px-4 py-2 text-xl text-white"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>{n} card{n > 1 ? 's' : ''}</option>
          ))}
        </select>

        <label className="sr-only" htmlFor="card-set-name">Card set name</label>
        <input
          id="card-set-name"
          type="text"
          value={cardSetName}
          onChange={(e) => setCardSetName(e.target.value)}
          placeholder="Card set name"
          maxLength={40}
          className="w-52 rounded border border-white/20 bg-bingo-bg px-4 py-2 text-xl text-white placeholder:text-bingo-muted"
        />

        <button
          type="button"
          onClick={handleNewCards}
          title="Generate new cards"
          className="flex h-11 w-11 items-center justify-center rounded border border-white/20 bg-bingo-bg text-white hover:bg-white/10"
        >
          <RefreshCw className="h-5 w-5" />
          <span className="sr-only">Generate new cards</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-bingo-accent px-6 py-2 text-lg font-bold text-bingo-bg hover:opacity-90"
        >
          <Printer className="h-5 w-5" />
          Print
        </button>

        <button
          type="button"
          onClick={handlePdfExport}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-xl border-2 border-bingo-accent px-6 py-2 text-lg font-bold text-bingo-accent hover:bg-bingo-accent hover:text-bingo-bg disabled:cursor-wait disabled:opacity-60"
        >
          <Download className="h-5 w-5" />
          {isExporting ? 'Preparing PDF...' : 'Download PDF'}
        </button>
        {exportError && <p role="alert" className="text-sm text-red-300">{exportError}</p>}
        {exportComplete && <p role="status" className="text-sm text-bingo-muted">PDF download started.</p>}
      </div>

      {/* Card display */}
      <div className="flex-1 overflow-auto">
        {variant === '75-ball' ? (
          <CardGrid75 cards={cards75} cardSetName={cardSetName} />
        ) : (
          <CardGrid90 cards={cards90} cardSetName={cardSetName} />
        )}
      </div>

      {/* Footer */}
      <p className="w-full bg-bingo-surface px-6 py-2 text-center text-sm text-bingo-muted">
        {variant} Bingo{printedDate ? ` — Printed ${printedDate}` : ''}
      </p>
    </div>
  );
}
