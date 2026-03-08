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
  if (!url) return null;
  const sizeClass = sizeClasses[size];
  return (
    <img
      src={url}
      alt=""
      className={`${sizeClass} object-contain shrink-0 rounded ${className}`}
    />
  );
}
