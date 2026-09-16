import React from 'react';

/**
 * TikTokIcon — nốt nhạc TikTok (lucide không có icon này). Dùng cho nav/header
 * tính năng TikTok. Kích thước điều khiển qua className (vd "h-5 w-5"); màu theo
 * currentColor để hoà với sidebar sáng/tối.
 */
const TikTokIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .73-5.08v-3.13a5.7 5.7 0 0 0-.73-.05A5.68 5.68 0 1 0 15.54 15.4V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.29 4.29 0 0 1-3.24-1.48z" />
  </svg>
);

export default TikTokIcon;
