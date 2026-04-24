import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';

export const UiModeToggle = () => {
  const user = useAuthStore((s) => s.user);
  const hasRole = useAuthStore((s) => s.hasRole);
  const setUiMode = useAuthStore((s) => s.setUiMode);
  const [toggling, setToggling] = useState(false);

  if (!hasRole('ENGINEER') && !hasRole('ADMIN')) {
    return null;
  }

  const currentMode = user?.uiMode ?? 'operator';
  const isEngineering = currentMode === 'engineering';

  const handleToggle = async (): Promise<void> => {
    setToggling(true);
    try {
      await setUiMode(isEngineering ? 'operator' : 'engineering');
    } finally {
      setToggling(false);
    }
  };

  return (
    <button
      onClick={() => { void handleToggle(); }}
      disabled={toggling}
      title={`Switch to ${isEngineering ? 'Operator' : 'Engineering'} Mode`}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800
        disabled:cursor-not-allowed disabled:opacity-60
        ${isEngineering
          ? 'bg-amber-700 hover:bg-amber-600 text-amber-100 focus:ring-amber-500'
          : 'bg-gray-600 hover:bg-gray-500 text-gray-200 focus:ring-gray-400'}
      `}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${isEngineering ? 'bg-amber-300' : 'bg-gray-400'}`}
      />
      {isEngineering ? 'Engineering Mode' : 'Operator Mode'}
    </button>
  );
};
