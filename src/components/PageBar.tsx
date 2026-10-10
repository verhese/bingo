import { ThemeToggle } from '@/components/ThemeToggle';

export function PageBar({ title, children }: { readonly title: string; readonly children?: React.ReactNode }) {
  return (
    <header className="page-bar">
      <h1>{title}</h1>
      <div className="page-bar-actions">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
