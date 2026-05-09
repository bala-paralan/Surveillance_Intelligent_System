export type IconName =
  | 'dash' | 'cam' | 'map' | 'bell' | 'inc' | 'srch' | 'tl' | 'rep' | 'dev'
  | 'user' | 'set' | 'moon' | 'sun' | 'plus' | 'x' | 'chev' | 'chevr'
  | 'filter' | 'dl' | 'play' | 'pause' | 'pin' | 'lock' | 'check' | 'eye'
  | 'grid' | 'list' | 'arrU' | 'arrD' | 'flag' | 'note' | 'refresh';

const PATHS: Record<IconName, string> = {
  dash:   'M3 3h7v9H3zM14 3h7v5h-7zM14 11h7v10h-7zM3 15h7v6H3z',
  cam:    'M3 7h11v10H3zM14 10l6-3v10l-6-3z',
  map:    'M9 3l-6 2v16l6-2 6 2 6-2V3l-6 2-6-2zM9 3v16M15 5v16',
  bell:   'M12 3a6 6 0 0 0-6 6v3l-2 4h16l-2-4V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0',
  inc:    'M12 2L2 21h20L12 2zM12 9v5M12 17v.5',
  srch:   'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16 16l5 5',
  tl:     'M3 12h18M5 6h14M5 18h14M9 12v-2M15 12v2M12 6v2M9 18v-2',
  rep:    'M4 4h12l4 4v12H4zM16 4v4h4M8 13h8M8 17h5M8 9h3',
  dev:    'M3 5h18v10H3zM7 19h10M9 15v4M15 15v4',
  user:   'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  set:    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12c0-.7-.1-1.3-.2-2l2-1.5-2-3.5-2.4 1c-1-.8-2.1-1.4-3.4-1.7L13 2h-4l-.4 2.3c-1.3.3-2.4.9-3.4 1.7l-2.4-1-2 3.5L2.8 10c-.1.7-.2 1.3-.2 2s.1 1.3.2 2l-2 1.5 2 3.5 2.4-1c1 .8 2.1 1.4 3.4 1.7L9 22h4l.4-2.3c1.3-.3 2.4-.9 3.4-1.7l2.4 1 2-3.5-2-1.5c.1-.7.2-1.3.2-2z',
  moon:   'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun:    'M12 5V3M12 21v-2M5 12H3M21 12h-2M6.3 6.3L4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  plus:   'M12 5v14M5 12h14',
  x:      'M5 5l14 14M19 5L5 19',
  chev:   'M6 9l6 6 6-6',
  chevr:  'M9 6l6 6-6 6',
  filter: 'M4 5h16M7 12h10M10 19h4',
  dl:     'M12 3v12M7 11l5 5 5-5M4 21h16',
  play:   'M6 4l14 8-14 8z',
  pause:  'M7 4h4v16H7zM13 4h4v16h-4z',
  pin:    'M12 2a6 6 0 0 0-6 6c0 5 6 13 6 13s6-8 6-13a6 6 0 0 0-6-6zM12 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  lock:   'M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4',
  check:  'M5 12l5 5 9-9',
  eye:    'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  grid:   'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  list:   'M4 6h16M4 12h16M4 18h16',
  arrU:   'M12 19V5M5 12l7-7 7 7',
  arrD:   'M12 5v14M5 12l7 7 7-7',
  flag:   'M5 21V4l8 3 6-2v11l-6 2-8-3z',
  note:   'M5 4h11l4 4v12H5zM14 4v4h4M8 12h8M8 16h5',
  refresh:'M3 12a9 9 0 0 1 16-5l2-2v6h-6M21 12a9 9 0 0 1-16 5l-2 2v-6h6',
};

interface IconProps {
  name: IconName;
  size?: number;
}

export const Icon = ({ name, size = 16 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={PATHS[name]} />
  </svg>
);
