import { Moon, Sun, DownloadCloud } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  return (
    <nav className="border-b border-border glass sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 p-2 rounded-xl">
            <DownloadCloud className="w-6 h-6 text-primary" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-gradient select-none">
            AnyDL
          </span>
        </div>

        {/* Theme Toggle */}
        <motion.button
          whileTap={{ scale: 0.9, rotate: 180 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={onToggleTheme}
          className="p-2.5 rounded-xl hover:bg-muted transition-colors"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-700" />
          )}
        </motion.button>
      </div>
    </nav>
  );
}
