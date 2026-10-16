import { ThemeProvider } from 'next-themes';

// Wraps the app with next-themes class-based dark mode. Detects and applies
// the system color-scheme preference automatically; users can override via
// the `data-theme`/class on <html>. `attribute="class"` makes Tailwind's
// `dark:` variants and the .dark token block resolve correctly.
export default function ThemeWrapper({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}