import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFadeAnimation } from '@/hooks/useFadeAnimation';
import IconButton from '@/components/ui/IconButton';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isFadeAnimation?: boolean;
}

const BaseModal: React.FC<BaseModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = 'md',
  isFadeAnimation = false
}) => {
  const { show, isAnimating } = useFadeAnimation(isOpen, isFadeAnimation);

  if (!show && !isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl'
  };

  return createPortal(
    // z-[80] > BaseSlidePanel (z-[70]) → modal luôn nổi trên slide panel (vd tạo KH trên form đơn).
    <div className="fixed inset-0 z-[80] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0 sm:px-4 sm:py-8">
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
            isFadeAnimation
              ? isAnimating
                ? 'opacity-100'
                : 'opacity-0'
              : isOpen
                ? 'opacity-100'
                : 'opacity-0'
          }`}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          className={`relative w-full transform overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-left shadow-2xl shadow-slate-200/50 ring-1 ring-slate-200/60 transition-all duration-300 ease-out dark:border-slate-700/90 dark:bg-slate-800 dark:shadow-none dark:ring-slate-700/80 sm:my-8 ${sizeClasses[size]} ${
            isFadeAnimation
              ? isAnimating
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95'
              : isOpen
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-primary-100/90 bg-gradient-to-r from-primary-50/95 via-white to-primary-50/50 px-6 py-5 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-primary-950/30">
            <h3
              className="min-w-0 flex-1 text-left text-xl font-bold tracking-tight text-slate-900 dark:text-white"
              id="modal-title"
            >
              {title}
            </h3>
            <IconButton
              onClick={onClose}
              label="Close modal"
              layoutClassName="shrink-0 rounded-full p-1.5"
              textClassName="text-slate-500 dark:text-slate-400"
              hoverClassName="hover:bg-white/90 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </IconButton>
          </div>

          <div className="max-h-[min(70vh,calc(100vh-8rem))] overflow-y-auto bg-white px-6 py-6 dark:bg-slate-800">
            {children}
          </div>

          {footer ? (
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/95 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3 dark:border-slate-700 dark:bg-slate-900/60">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BaseModal;