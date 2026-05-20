import { useLayoutStore } from '@/store/layoutStore';
import type { LayoutMode } from '@/store/layoutStore';

// ── Layout button definitions ─────────────────────────────────────────────────

interface LayoutButton {
  mode: LayoutMode;
  label: string;
  title: string;
}

const LAYOUT_BUTTONS: LayoutButton[] = [
  { mode: '1',  label: '1×1', title: 'Single pane' },
  { mode: '2h', label: '2H',  title: 'Two panes side by side' },
  { mode: '2v', label: '2V',  title: 'Two panes stacked' },
  { mode: '4',  label: '2×2', title: 'Four panes grid' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const LayoutSwitcher = () => {
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);

  return (
    <div
      className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1"
      role="toolbar"
      aria-label="Layout switcher"
    >
      {LAYOUT_BUTTONS.map(({ mode, label, title }) => (
        <button
          key={mode}
          type="button"
          title={title}
          onClick={() => setLayout(mode)}
          className={`
            px-3 py-1.5 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
            ${layout === mode
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'}
          `}
          aria-pressed={layout === mode}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
