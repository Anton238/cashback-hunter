import { BankMark } from './BankMark';

export function PriorityList({ items, onMove, disabled, showBankIcons = false }: {
  items: { id: number; name: string }[];
  onMove: (index: number, target: number) => void;
  disabled: boolean;
  showBankIcons?: boolean;
}) {
  return <div className="priority-list">{items.map((item, index) => <div className="priority-row" key={item.id}>
    <span className="priority-number">{index + 1}</span>{showBankIcons && <BankMark name={item.name}/>}<span className="priority-name">{item.name}</span>
    <button type="button" aria-label={`Поднять ${item.name} в начало`} disabled={disabled || index === 0} onClick={() => onMove(index, 0)}>⇈</button>
    <button type="button" aria-label={`Поднять ${item.name}`} disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)}>↑</button>
    <button type="button" aria-label={`Опустить ${item.name}`} disabled={disabled || index === items.length - 1} onClick={() => onMove(index, index + 1)}>↓</button>
  </div>)}</div>;
}
