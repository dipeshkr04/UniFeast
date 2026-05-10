import { HiOutlineMoon, HiOutlineSun } from 'react-icons/hi';
import { useTheme } from '../../contexts/ThemeContext';

export default function ThemeToggle({ variant = 'nav' }) {
  const { isLight, toggleTheme } = useTheme();
  const Icon = isLight ? HiOutlineMoon : HiOutlineSun;
  const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn theme-toggle-${variant}`}
      aria-label={label}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
