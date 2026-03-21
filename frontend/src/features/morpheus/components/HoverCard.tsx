// frontend/src/features/morpheus/components/HoverCard.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface HoverCardProps {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
}

export default function HoverCard({ content, children, delay = 200 }: HoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [positionAbove, setPositionAbove] = useState(true);
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const cardHeight = 120; // estimate
      const spaceAbove = rect.top;
      const above = spaceAbove > cardHeight;
      const top = above ? rect.top - 8 : rect.bottom + 8;
      const left = Math.min(rect.left, window.innerWidth - 280);
      setPosition({ top, left });
      setPositionAbove(above);
      setVisible(true);
    }, delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    if (visible) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [visible]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-block"
      >
        {children}
      </div>
      {visible && (
        <div
          ref={cardRef}
          className="fixed z-50 max-w-[260px] rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 text-xs text-[#C5C0B8] shadow-xl"
          style={{ top: position.top, left: position.left, transform: positionAbove ? 'translateY(-100%)' : undefined }}
          onMouseEnter={() => clearTimeout(timeoutRef.current)}
          onMouseLeave={hide}
        >
          {content}
        </div>
      )}
    </>
  );
}
