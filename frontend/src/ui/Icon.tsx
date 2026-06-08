import type { CSSProperties, SVGProps } from 'react';

// Feather-ish icon set, 1.7 stroke. Add new glyphs here; the name union derives from the keys.
const PATHS = {
  chrome: <g><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /><path d="M12 8.8h8.2M9.1 13.6 5 20.6M14.9 13.6 19 20.6" /></g>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <g><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></g>,
  grid: <g><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></g>,
  table: <g><rect x="3.5" y="4.5" width="17" height="15" rx="1.6" /><path d="M3.5 9.5h17M3.5 14.5h17M9 9.5v10" /></g>,
  list: <g><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></g>,
  monitor: <g><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></g>,
  play: <path d="M7 5.5v13l11-6.5z" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="1.6" />,
  refresh: <g><path d="M3.5 8a8 8 0 0 1 14-2.5L20 8M20 4.5V8h-3.5" /><path d="M20.5 16a8 8 0 0 1-14 2.5L4 16M4 19.5V16h3.5" /></g>,
  trash: <g><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 7" /></g>,
  settings: <g><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.7 18.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13H3.9a2 2 0 1 1 0-4H4a1.6 1.6 0 0 0 1.5-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4V3.9a2 2 0 1 1 4 0V4a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20 11h.1a2 2 0 1 1 0 4H20a1.6 1.6 0 0 0-.6.8z" /></g>,
  maximize: <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />,
  minimize: <path d="M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5 9.5 17 19 7" />,
  chevDown: <path d="m6 9 6 6 6-6" />,
  chevRight: <path d="m9 6 6 6-6 6" />,
  chevLeft: <path d="m15 6-6 6 6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  dots: <g><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></g>,
  drag: <g><circle cx="9" cy="6" r="1.3" /><circle cx="15" cy="6" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="9" cy="18" r="1.3" /><circle cx="15" cy="18" r="1.3" /></g>,
  record: <g><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" /></g>,
  sun: <g><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />,
  globe: <g><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" /></g>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  server: <g><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></g>,
  layers: <path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 16.5l9 5 9-5" />,
  clock: <g><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></g>,
  cursor: <path d="m5 3 6 17 2.5-6.5L20 11 5 3z" />,
  keyboard: <g><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 13h.01M18 9.5h.01M8 14.5h8" /></g>,
  type: <path d="M5 6h14M12 6v13M9 19h6" />,
  target: <g><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></g>,
  eye: <g><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></g>,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  copy: <g><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></g>,
  alert: <g><path d="M12 3 2.5 19.5h19z" /><path d="M12 10v4M12 17h.01" /></g>,
  power: <g><path d="M12 4v8" /><path d="M7 6.5a8 8 0 1 0 10 0" /></g>,
  image: <g><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="m4 18 5-5 3.5 3.5L16 13l4 4" /></g>,
  sort: <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />,
  sliders: <g><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></g>,
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none', ...style }}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
