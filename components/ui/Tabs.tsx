import React, { useEffect, useMemo, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface TabsItem {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
  badge?: React.ReactNode;
}

export interface TabsProps {
  items: TabsItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({ items, value, onChange, className }) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const activeIndex = useMemo(() => items.findIndex((item) => item.id === value), [items, value]);

  useEffect(() => {
    const updateIndicator = () => {
      if (activeIndex < 0) return;
      const activeButton = tabRefs.current[activeIndex];
      const container = containerRef.current;
      if (!activeButton || !container) return;

      // offsetLeft (toạ độ trong CONTENT) chứ không phải getBoundingClientRect (toạ độ màn
      // hình): gạch chân nằm absolute trong container cuộn ngang, dùng rect thì dải tab dài
      // vừa cuộn là gạch lệch đúng bằng scrollLeft.
      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      });
    };

    updateIndicator();
    // Font/badge về muộn làm đổi bề rộng tab → đo lại ở frame sau.
    const raf = requestAnimationFrame(updateIndicator);
    window.addEventListener('resize', updateIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeIndex, items]);

  const wrapperClassName = twMerge(['w-full border-b border-slate-200 dark:border-slate-700', className ?? ''].filter(Boolean).join(' '));

  return (
    <div className={wrapperClassName}>
      <div ref={containerRef} className="relative flex gap-4 overflow-x-auto scrollbar-hide sm:gap-6">
        {items.map((item, index) => {
          const isActive = value === item.id;
          const isDisabled = Boolean(item.disabled);
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              onClick={() => !isDisabled && onChange(item.id)}
              disabled={isDisabled}
              className={`relative shrink-0 whitespace-nowrap pb-2 text-sm font-semibold tracking-wide uppercase transition-colors duration-200 ${
                isActive
                  ? 'text-primary-500 dark:text-primary-400'
                  : isDisabled
                    ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                    : 'text-slate-500 hover:text-primary-500 dark:text-slate-300 dark:hover:text-primary-400'
              }`}
            >
              {item.label}
              {item.badge}
            </button>
          );
        })}
        <span
          className="absolute bottom-0 h-0.5 rounded-full bg-primary-500 transition-all duration-300 ease-out dark:bg-primary-400"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`
          }}
        />
      </div>
    </div>
  );
};

export default Tabs;
