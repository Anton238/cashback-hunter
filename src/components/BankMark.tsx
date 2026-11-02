import { Landmark } from 'lucide-react';
import { bankKey } from '../lib/presentation';

export function BankMark({ name, size = 'small' }: { name: string; size?: 'small' | 'large' }) {
  const key = bankKey(name);
  return <span className={`bank-mark bank-mark-${size}`} title={name} aria-label={name}>{key ? <img src={`/banks/${key}.png`} alt="" /> : <Landmark size={size === 'large' ? 22 : 16}/>}</span>;
}
