import { useEffect, useMemo, useState } from 'react';
import { apiBanks, apiCashback, apiCategories, type Bank, type CashbackEntry, type Category, recognize, saveCorrection, apiPush } from './lib/api';
import { getThreeMonths } from './lib/months';
import { usePush } from './hooks/usePush';
import { optimize, type Offer } from './lib/optimizer';

type Screen = 'home' | 'add' | 'banks';
type Mode = 'selected' | 'arrange';
const uid = () => crypto.randomUUID();
const fileToData = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Не удалось прочитать файл')); reader.readAsDataURL(file);
});
const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);

export function App() {
  const months = getThreeMonths();
  const [monthIndex, setMonthIndex] = useState(1);
  const month = months[monthIndex];
  const [screen, setScreen] = useState<Screen>(() => new URLSearchParams(location.search).get('screen') === 'add' ? 'add' : 'home');
  const push = usePush();
  const [pushMessage, setPushMessage] = useState('');
  const [mode, setMode] = useState<Mode>('selected');
  const [banks, setBanks] = useState<Bank[]>([]), [categories, setCategories] = useState<Category[]>([]), [entries, setEntries] = useState<CashbackEntry[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]), [bankId, setBankId] = useState<number>(0), [bankName, setBankName] = useState('');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [query, setQuery] = useState('');
  const [reviewBank, setReviewBank] = useState<number>(0);
  async function refresh() {
    const [b, c, e] = await Promise.all([apiBanks.list(), apiCategories.list(), apiCashback.list(month.month, month.year)]);
    setBanks(b); setCategories(c); setEntries(e); setBankId(old => old || b[0]?.id || 0);
  }
  useEffect(() => { refresh().catch(e => setError(e.message)); }, [month.month, month.year]);
  const grouped = useMemo(() => {
    const map = new Map<string, CashbackEntry[]>();
    for (const item of entries) { const list = map.get(item.category_name) ?? []; list.push(item); map.set(item.category_name, list); }
    return [...map.entries()].filter(([name]) => name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))).sort((a,b) => a[0].localeCompare(b[0], 'ru'));
  }, [entries, query]);
  const limits = Object.fromEntries(banks.map(b => [b.id, b.selection_limit ?? 3]));
  function edit(id: string, patch: Partial<Offer>) { setOffers(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o)); }
  async function upload(files: FileList | null) {
    if (!files?.length || !bankId) return;
    setBusy('Читаем скриншоты…'); setError('');
    try {
      for (const file of Array.from(files)) {
        if (file.size > 3_500_000 || !/image\/(jpeg|png|webp)/.test(file.type)) throw new Error('Поддерживаются JPEG, PNG и WebP до 3,5 МБ.');
        const result = await recognize(await fileToData(file), bankId);
        const parsed = result.items.filter(x => x && typeof x.category === 'string' && Number.isFinite(Number(x.percentage)) && Number(x.percentage) >= 0 && Number(x.percentage) <= 100).map(x => ({ id: uid(), bankId, category: x.category.trim(), suggestedCategory: x.category.trim(), name: String(x.name ?? x.category), percentage: Number(x.percentage), notes: String(x.notes ?? ''), selected: true }));
        setOffers(old => [...old, ...parsed]);
        if (!parsed.length) throw new Error('На одном из скриншотов не найдены категории. Добавьте их вручную.');
      }
      setReviewBank(bankId);
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  function distribute() {
    const picked = optimize(offers.filter(o => o.category.trim()), limits);
    setOffers(old => old.map(o => ({ ...o, selected: picked.has(o.id) })));
    setReviewBank(offers[0]?.bankId ?? 0);
  }
  async function save() {
    const chosen = offers.filter(o => o.selected);
    if (!chosen.length) { setError('Выберите хотя бы один кэшбэк.'); return; }
    if (chosen.some(o => !o.category.trim() || !Number.isFinite(o.percentage) || o.percentage < 0 || o.percentage > 100)) { setError('Проверьте категории и проценты.'); return; }
    if (mode === 'arrange' && banks.some(b => chosen.filter(o => o.bankId === b.id).length > (limits[b.id] ?? 0))) { setError('Превышен лимит категорий одного из банков.'); return; }
    const keys = chosen.map(o => `${o.bankId}:${o.category.trim().toLocaleLowerCase('ru')}`);
    if (new Set(keys).size !== keys.length) { setError('В одном банке выбрана одна категория несколько раз.'); return; }
    if (chosen.some(o => entries.some(e => e.bank_id === o.bankId && e.category_name.toLocaleLowerCase('ru') === o.category.trim().toLocaleLowerCase('ru'))) && !confirm('Некоторые категории уже сохранены за этот месяц. Обновить их?')) return;
    setBusy('Сохраняем…'); setError('');
    try {
      let all = [...categories];
      for (const o of chosen) {
        let cat = all.find(c => c.name.toLocaleLowerCase('ru') === o.category.trim().toLocaleLowerCase('ru'));
        if (!cat) { cat = await apiCategories.create(o.category.trim()); all = [...all, cat]; }
        await apiCashback.create({ bank_id: o.bankId, category_id: cat.id, percentage: o.percentage, month: month.month, year: month.year, notes: [o.name && o.name !== o.category ? `В банке: ${o.name}` : '', o.notes].filter(Boolean).join(' · ') });
        if (o.suggestedCategory !== undefined && o.name.trim() && o.category.trim().toLocaleLowerCase('ru') !== o.suggestedCategory.trim().toLocaleLowerCase('ru')) await saveCorrection(o.bankId, cat.id, o.name.trim());
        setOffers(old => old.filter(x => x.id !== o.id));
      }
      await refresh(); setOffers([]); setScreen('home');
    } catch (e) { setError(`Не всё удалось сохранить: ${(e as Error).message}. Уже сохранённые строки убраны из списка.`); } finally { setBusy(''); }
  }
  const current = offers.filter(o => o.bankId === reviewBank);
  return <div className="app">
    <main><img className="hunter-icon" src="/hunter-icon.png" alt="" aria-hidden="true" />
      {error && <div className="error" role="alert">{error}<button onClick={() => setError('')} aria-label="Закрыть">×</button></div>}
      {screen === 'home' && <><h1>Кэшбэки</h1>
        <div className="month-switch">{months.map((m,i) => <button key={m.label} className={i === monthIndex ? 'active' : ''} onClick={() => setMonthIndex(i)}><span>{i === 0 ? 'ПРОШЛЫЙ' : i === 1 ? 'ТЕКУЩИЙ' : 'СЛЕДУЮЩИЙ'}</span>{m.label.split(' ')[0]}</button>)}</div>
        <div className="section-line"><div><h2>Категории <span className="count">{grouped.length}</span></h2></div><button className="round-add" onClick={() => { setMonthIndex(monthIndex === 0 ? 1 : monthIndex); setScreen('add'); }}>＋</button></div>
        <input className="search" placeholder="⌕  Найти категорию" value={query} onChange={e => setQuery(e.target.value)} aria-label="Поиск категории"/>
        <div className="cards">{grouped.map(([name, rows]) => { const sorted = [...rows].sort((a,b) => b.percentage-a.percentage); return <article className="cash-card" key={name}><div className="card-main"><span className="category-icon">{name.slice(0,1).toUpperCase()}</span><div className="card-title"><h3>{name}</h3><p>лучшее предложение · {sorted[0].bank_name}</p></div><strong className="rate">{fmt(sorted[0].percentage)}<small>%</small></strong></div><div className="card-details">{sorted.map(e => <div key={e.id}><span>{e.bank_name} · {fmt(e.percentage)}% {e.notes && `— ${e.notes}`}</span><button onClick={async () => { if (confirm('Удалить этот кэшбэк?')) { try { await apiCashback.delete(e.id); await refresh(); } catch (err) { setError((err as Error).message); } } }} aria-label={`Удалить ${e.bank_name}`}>×</button></div>)}</div></article>; })}</div>
        {!grouped.length && !error && <div className="empty"><span>✳</span><h3>Пока ничего нет</h3><p>Добавьте категории или скриншоты.</p><button className="primary" onClick={() => { setMonthIndex(monthIndex === 0 ? 1 : monthIndex); setScreen('add'); }}>Добавить кэшбэк</button></div>}
        <div className="baseline"><span>✦</span><div><strong>На всё остальное — 1%</strong><p>Базовый кэшбэк Т-Банка. Проверьте условия вашей карты.</p></div></div></>}
      {screen === 'add' && <><h1>Добавить</h1>
        <div className="segment"><button className={mode === 'selected' ? 'active' : ''} onClick={() => setMode('selected')}>Уже выбраны</button><button className={mode === 'arrange' ? 'active' : ''} onClick={() => setMode('arrange')}>Помочь выбрать</button></div>
        <div className="panel"><label>Месяц<select value={monthIndex === 0 ? 1 : monthIndex} onChange={e => setMonthIndex(Number(e.target.value))}><option value={1}>{months[1].label}</option><option value={2}>{months[2].label}</option></select></label><label>Банк<select value={bankId} onChange={e => setBankId(Number(e.target.value))}>{banks.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label><label className="upload"><span>＋</span><strong>Загрузить скриншоты</strong><small>Можно выбрать несколько фото · JPEG, PNG, WebP</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { upload(e.target.files); e.currentTarget.value = ''; }} disabled={!!busy || !bankId}/></label><p className="hint">Скриншоты отправляются в Cloudflare Workers AI для распознавания. Проверьте, что на них нет лишних личных данных.</p><button className="secondary" onClick={() => { const o: Offer = { id: uid(), bankId, name: '', category: '', percentage: 0, notes: '', selected: true }; setOffers(old => [...old, o]); setReviewBank(bankId); }} disabled={!bankId}>＋ Добавить вручную</button></div>
        {offers.length > 0 && <><div className="section-line"><div><h2>Проверка <span className="count">{offers.length}</span></h2></div></div>{mode === 'arrange' && <><p className="hint">Проверьте категории и распределите по лимитам банков.</p><button className="secondary" onClick={distribute}>✦ Распределить предложения</button></>}
          <div className="bank-tabs">{banks.filter(b => offers.some(o => o.bankId === b.id)).map(b => <button className={reviewBank === b.id ? 'active' : ''} key={b.id} onClick={() => setReviewBank(b.id)}>{b.name} · {offers.filter(o => o.bankId === b.id && o.selected).length}</button>)}</div>
          {current.map(o => <div className="review-card" key={o.id}><div className="review-head"><label className="check"><input type="checkbox" checked={o.selected} onChange={e => edit(o.id, { selected: e.target.checked })}/> Выбрать</label><button onClick={() => setOffers(old => old.filter(x => x.id !== o.id))}>Удалить ×</button></div><label>Название в банке<input value={o.name} onChange={e => edit(o.id, { name: e.target.value })} placeholder="Например, Супермаркеты"/></label><div className="fields"><label>Категория<input list="categories" value={o.category} onChange={e => edit(o.id, { category: e.target.value })} placeholder="Выберите или создайте"/></label><label>Кэшбэк, %<input type="number" min="0" max="100" step="0.1" value={o.percentage} onChange={e => edit(o.id, { percentage: Number(e.target.value) })}/></label></div><label>Условия и заметки<input value={o.notes} onChange={e => edit(o.id, { notes: e.target.value })} placeholder="Лимит, условия начисления…"/></label></div>)}<datalist id="categories">{categories.map(c => <option value={c.name} key={c.id}/>)}</datalist><button className="primary full" disabled={!!busy} onClick={save}>Сохранить выбранные · {offers.filter(o => o.selected).length}</button></>}{busy && <p className="busy">{busy}</p>}</>}
      {screen === 'banks' && <><h1>Банки</h1><div className="panel"><strong>Напоминания</strong><p className="hint">В последний день месяца</p>{push.state === 'unsupported' ? <p className="hint">Уведомления не поддерживаются на этом устройстве.</p> : push.state === 'denied' ? <p className="hint">Разрешите уведомления в настройках устройства.</p> : <div className="push-actions"><button className="secondary" disabled={push.state === 'loading'} onClick={async () => { try { if (push.state === 'subscribed') await push.unsubscribe(); else await push.subscribe(); setPushMessage(''); } catch (e) { setPushMessage((e as Error).message); } }}>{push.state === 'loading' ? 'Загрузка…' : push.state === 'subscribed' ? 'Выключить' : 'Включить'}</button>{push.state === 'subscribed' && <button className="secondary" onClick={async () => { try { const endpoint = await push.getEndpoint(); if (!endpoint) throw new Error('Подписка не найдена'); await apiPush.test(endpoint); setPushMessage('Тестовое уведомление отправлено'); } catch (e) { setPushMessage((e as Error).message); } }}>Проверить</button>}</div>}{pushMessage && <p className="hint" role="status">{pushMessage}</p>}</div><div className="cards">{banks.map(b => <div className="bank-row" key={b.id}><span className="category-icon">{b.name.slice(0,1)}</span><div><strong>{b.name}</strong><p>Лимит категорий</p></div><input type="number" min="0" max="50" defaultValue={b.selection_limit ?? 3} aria-label={`Лимит ${b.name}`} onBlur={async e => { try { await apiBanks.update(b.id, { selection_limit: Number(e.target.value) }); await refresh(); } catch (err) { setError((err as Error).message); } }}/></div>)}</div><div className="panel"><label>Новый банк<input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Название банка"/></label><button className="secondary" onClick={async () => { try { await apiBanks.create(bankName); setBankName(''); await refresh(); } catch (e) { setError((e as Error).message); } }} disabled={!bankName.trim()}>Добавить банк</button></div></>}
    </main><nav className="bottom"><button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}><span>◫</span>Кэшбэки</button><button className={screen === 'add' ? 'active' : ''} onClick={() => { if (monthIndex === 0) setMonthIndex(1); setScreen('add'); }}><span>⊕</span>Добавить</button><button className={screen === 'banks' ? 'active' : ''} onClick={() => setScreen('banks')}><span>◈</span>Банки</button></nav></div>;
}
