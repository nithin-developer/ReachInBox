import React from 'react';
import { useTheme } from '@/components/theme-provider';
import { IconSun, IconMoon } from '@tabler/icons-react';

export interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, setTheme } = useTheme();

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`h-9 w-9 rounded-xl border border-border/70 bg-card hover:bg-muted text-foreground flex items-center justify-center transition-all shadow-2xs focus:outline-none cursor-pointer ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <IconSun className="h-4.5 w-4.5 text-amber-500 transition-transform duration-200 rotate-0 scale-100" />
      ) : (
        <IconMoon className="h-4.5 w-4.5 text-slate-700 dark:text-slate-200 transition-transform duration-200 rotate-0 scale-100" />
      )}
    </button>
  );
};
