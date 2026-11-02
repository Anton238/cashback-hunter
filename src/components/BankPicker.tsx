import type { Bank } from '../lib/api';
import { BankMark } from './BankMark';

export function BankPicker({ banks, value, onChange }: { banks: Bank[]; value: number; onChange: (id: number) => void }) {
  const selected = banks.find(bank => bank.id === value);
  return <details className="bank-picker"><summary><BankMark name={selected?.name ?? ''}/><span>{selected?.name ?? 'Выберите банк'}</span><span aria-hidden="true">⌄</span></summary><div className="bank-picker-list">{banks.map(bank => <button type="button" key={bank.id} aria-pressed={bank.id === value} onClick={e => { onChange(bank.id); e.currentTarget.closest('details')?.removeAttribute('open'); }}><BankMark name={bank.name}/>{bank.name}</button>)}</div></details>;
}
