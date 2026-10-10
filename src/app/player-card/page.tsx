'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import type { GameVariant, RoomSummary } from '@/types/game';
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
        <article
          data-pdf-card
          key={`75-card-${ci}`}
          aria-labelledby={`75-card-title-${ci}`}
          className="mx-auto w-fit rounded border-2 border-black p-4"
          style={{ backgroundColor: '#ffffff', color: '#000000' }}
        >
          <h2 id={`75-card-title-${ci}`} className="sr-only">
            75-ball bingo card {ci + 1}{cardSetName ? ` for ${cardSetName}` : ''}
          </h2>
          <table className="border-collapse border border-black">
            <caption className="sr-only">75-ball bingo card {ci + 1}</caption>
            <thead>
              <tr className="text-3xl font-bold tracking-widest" style={{ color: '#101827' }}>
                {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                  <th key={letter} scope="col" className="w-16 text-center">{letter}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {card.map((row, rowIndex) => (
                <tr key={`${ci}-${rowIndex}`}>
                  {row.map((cell, columnIndex) => (
                    <td
                      key={`${ci}-${rowIndex}-${columnIndex}`}
                      className="h-16 w-16 border border-black text-center align-middle text-2xl font-bold"
                      style={{ backgroundColor: cell === FREE_CELL ? '#fef08a' : '#ffffff' }}
                    >
                      {cell === FREE_CELL ? <><span aria-hidden="true">★</span><span className="sr-only">Free space</span></> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {cardSetName && <p className="mt-3 text-center text-lg font-bold" style={{ color: '#475569' }}>{cardSetName}</p>}
        </article>
      ))}
    </div>
  );
}

function CardGrid90({ cards, cardSetName }: { readonly cards: Card90[]; cardSetName: string }) {
  const columns = ['1 to 9', '10 to 19', '20 to 29', '30 to 39', '40 to 49', '50 to 59', '60 to 69', '70 to 79', '80 to 90'];

  return (
    <div id="print-area" className="space-y-8 p-6">
      {cards.map((card, ci) => (
        // eslint-disable-next-line react/no-array-index-key
        <article
          data-pdf-card
          key={`90-card-${ci}`}
          aria-labelledby={`90-card-title-${ci}`}
          className="mx-auto w-fit rounded border-2 border-black p-4"
          style={{ backgroundColor: '#ffffff', color: '#000000' }}
        >
          <h2 id={`90-card-title-${ci}`} className="sr-only">
            90-ball bingo card {ci + 1}{cardSetName ? ` for ${cardSetName}` : ''}
          </h2>
          <table className="border-collapse border border-black">
            <caption className="sr-only">90-ball bingo card {ci + 1}</caption>
            <thead className="sr-only">
              <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
            </thead>
            <tbody>
              {card.map((row, rowIndex) => (
                <tr key={`${ci}-${rowIndex}`}>
                  {row.row.map((num, colIndex) => (
                    row.blanks[colIndex] ? (
                      <td key={`${ci}-${rowIndex}-${colIndex}`} aria-label="Blank" className="h-12 w-14 border border-black text-center align-middle" />
                    ) : (
                      <td key={`${ci}-${rowIndex}-${colIndex}`} className="h-12 w-14 border border-black text-center align-middle text-xl font-bold">
                        {num}
                      </td>
                    )
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {cardSetName && <p className="mt-3 text-center text-lg font-bold" style={{ color: '#475569' }}>{cardSetName}</p>}
        </article>
      ))}
    </div>
  );
}

export default function PlayerCardPage() {
  const [variant, setVariant] = useState<GameVariant>('75-ball');
  const [cardCount, setCardCount] = useState(6);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
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

  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/game?rooms=true');
      if (!response.ok) return;
      const result = (await response.json()) as { sessions?: RoomSummary[] };
      if (Array.isArray(result.sessions)) setRooms(result.sessions);
    } catch {
      // Card generation remains available if the room directory is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const cardSetName = rooms.find((room) => room.sessionId === selectedRoomId)?.roomName ?? '';
  const supportedRooms = rooms.filter((room) => room.variant === '75-ball' || room.variant === '90-ball');

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
    <main className="flex min-h-screen w-full flex-col items-center bg-bingo-bg">
      <h1 className="py-3 text-2xl font-bold text-bingo-text">Player bingo cards</h1>
      <section aria-label="Card set controls" className="flex w-full flex-wrap items-center justify-center gap-4 bg-bingo-surface p-4">
        <label htmlFor="card-count" className="font-bold text-bingo-text">Number of cards</label>
        <select
          id="card-count"
          value={cardCount}
          onChange={(e) => handleCardCountChange(Number(e.target.value))}
          className="rounded border border-bingo-muted bg-bingo-bg px-4 py-2 text-xl text-bingo-text"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>{n} card{n > 1 ? 's' : ''}</option>
          ))}
        </select>

        <label className="sr-only" htmlFor="card-set-room">Card set room</label>
        <select
          id="card-set-room"
          value={selectedRoomId}
          onChange={(event) => {
            const room = supportedRooms.find((candidate) => candidate.sessionId === event.target.value);
            setSelectedRoomId(event.target.value);
            if (room) setVariant(room.variant);
          }}
          onFocus={() => void loadRooms()}
          className="w-52 rounded border border-bingo-muted bg-bingo-bg px-4 py-2 text-xl text-bingo-text"
        >
          <option value="">Select room</option>
          {supportedRooms.map((room) => (
            <option key={room.sessionId} value={room.sessionId}>{room.roomName} - {room.variant}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleNewCards}
          className="flex h-11 w-11 items-center justify-center rounded border border-bingo-muted bg-bingo-bg text-bingo-text hover:bg-bingo-undrawn"
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Generate new cards</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-bingo-accent px-6 py-2 text-lg font-bold text-bingo-bg hover:opacity-90"
        >
          <Printer className="h-5 w-5" aria-hidden="true" />
          Print
        </button>

        <button
          type="button"
          onClick={handlePdfExport}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-xl border-2 border-bingo-accent px-6 py-2 text-lg font-bold text-bingo-accent hover:bg-bingo-accent hover:text-bingo-bg disabled:cursor-wait disabled:opacity-60"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          {isExporting ? 'Preparing PDF...' : 'Download PDF'}
        </button>
        {exportError && <p role="alert" className="text-sm text-bingo-danger">{exportError}</p>}
        {exportComplete && <p role="status" className="text-sm text-bingo-muted">PDF download started.</p>}
      </section>

      <section aria-label="Generated bingo cards" className="w-full flex-1 overflow-auto">
        {variant === '75-ball' ? (
          <CardGrid75 cards={cards75} cardSetName={cardSetName} />
        ) : (
          <CardGrid90 cards={cards90} cardSetName={cardSetName} />
        )}
      </section>

      <footer className="w-full bg-bingo-surface px-6 py-2 text-center text-sm text-bingo-muted">
        {variant} Bingo{printedDate ? ` — Printed ${printedDate}` : ''}
      </footer>
    </main>
  );
}
