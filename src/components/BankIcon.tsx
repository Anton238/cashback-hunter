import { useState } from 'react';
import { getBankIconUrl } from '../lib/constants';

interface Props {
  bankName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function BankIcon({ bankName, className = '', size = 'md' }: Props) {
  const url = getBankIconUrl(bankName);
  const [failed, setFailed] = useState(false);
  if (!url) {
    return (
      <span
        className={`${sizeClasses[size]} shrink-0 rounded bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-medium ${className}`}
        aria-hidden
      >
        {bankName.trim().slice(0, 1).toUpperCase() || '?'}
      </span>
    );
  }
  if (failed) {
    return (
      <span
        className={`${sizeClasses[size]} shrink-0 rounded bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-medium ${className}`}
        aria-hidden
      >
        {bankName.trim().slice(0, 1).toUpperCase() || '?'}
      </span>
    );
  }
  const sizeClass = sizeClasses[size];
  return (
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      className={`${sizeClass} object-contain shrink-0 rounded ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
