import React from 'react';
import { clsx } from 'clsx';

export type StatusBadgeVariant = 'ready' | 'pending' | 'warning' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  className
}) => {
  const getStyles = (): string => {
    switch (variant) {
      case 'ready':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'pending':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'neutral':
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide',
        getStyles(),
        className
      )}
    >
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', {
          'bg-emerald-500': variant === 'ready',
          'bg-amber-500': variant === 'warning',
          'bg-blue-500': variant === 'pending',
          'bg-muted-foreground': variant === 'neutral'
        })}
      />
      {label}
    </span>
  );
};
