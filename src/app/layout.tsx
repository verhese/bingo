import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Bingo',
  description: 'Bingo afternoons for our non-profit — accessible, clear, big displays.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="bg-bingo-bg text-bingo-text antialiased">
        {children}
      </body>
    </html>
  );
}
