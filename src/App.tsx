import { useEffect, useMemo, useState } from 'react';
import { apiBanks, apiCashback, apiCategories, type Bank, type CashbackEntry, type Category, recognize, saveCorrection, apiPush } from './lib/api';
import { getThreeMonths } from './lib/months';
import { usePush } from './hooks/usePush';
import { optimize, type Offer } from './lib/optimizer';
import { bankPriority, categoryPriority, rateClass } from './lib/presentation';
import { BankMark } from './components/BankMark';
import { CategoryMark } from './components/CategoryMark';
import { BankPicker } from './components/BankPicker';

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [photos, setPhotos] = useState<{ id: string; name: string; bankId: number; suggestedBankId: number | null }[]>([]);
  async function refresh() {
    const [b, c, e] = await Promise.all([apiBanks.list(), apiCategories.list(), apiCashback.list(month.month, month.year)]);
    setBanks(b); setCategories(c); setEntries(e); setBankId(old => old || b[0]?.id || 0);
  }
  useEffect(() => { refresh().catch(e => setError(e.message)); }, [month.month, month.year]);
  const grouped = useMemo(() => {
    const map = new Map<string, CashbackEntry[]>();
    for (const item of entries) { const list = map.get(item.category_name) ?? []; list.push(item); map.set(item.category_name, list); }
    return [...map.entries()].filter(([name]) => name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))).sort((a,b) => categoryPriority(a[0]) - categoryPriority(b[0]) || a[0].localeCompare(b[0], 'ru'));
  }, [entries, query]);
  const limits = Object.fromEntries(banks.map(b => [b.id, b.selection_limit ?? 3]));
  function edit(id: string, patch: Partial<Offer>) { setOffers(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o)); }
  async function upload(files: File[]) {
    if (!files?.length) return;
    setBusy('Читаем скриншоты…'); setError('');
    let currentFile = '';
    try {
      let firstBank: number | undefined;
      for (const file of Array.from(files)) {
        currentFile = file.name;
        if (file.size > 3_500_000 || !/image\/(jpeg|png|webp)/.test(file.type)) throw new Error('Поддерживаются JPEG, PNG и WebP до 3,5 МБ.');
        const result = await recognize(await fileToData(file));
        const photoId = uid();
        const detectedBank = result.bankId ?? 0;
        const parsed = result.items.filter(x => x && typeof x.category === 'string' && Number.isFinite(Number(x.percentage)) && Number(x.percentage) >= 0 && Number(x.percentage) <= 100).map(x => ({ id: uid(), bankId: detectedBank, photoId, category: x.category.trim(), suggestedCategory: x.category.trim(), name: String(x.name ?? x.category), percentage: Number(x.percentage), notes: String(x.notes ?? ''), selected: true }));
        if (!parsed.length) throw new Error('На скриншоте не найдены категории. Попробуйте другое фото или добавьте их вручную.');
        setPhotos(old => [...old, { id: photoId, name: file.name, bankId: detectedBank, suggestedBankId: result.bankId }]);
        if (firstBank === undefined) { firstBank = detectedBank; setReviewBank(detectedBank); }
        setOffers(old => [...old, ...parsed]);
        setPendingFiles(old => old.filter(f => f !== file));
      }
      if (firstBank !== undefined) setReviewBank(firstBank);
    } catch (e) { setError(`${currentFile ? `${currentFile}: ` : ''}${(e as Error).message}`); } finally { setBusy(''); }
  }
  function distribute() {
    const picked = optimize(offers.filter(o => o.category.trim()), limits);
    setOffers(old => old.map(o => ({ ...o, selected: picked.has(o.id) })));
    setReviewBank(offers[0]?.bankId ?? 0);
  }
  async function save() {
    const chosen = offers.filter(o => o.selected);
    if (!chosen.length) { setError('Выберите хотя бы один кэшбэк.'); return; }
    if (chosen.some(o => !o.bankId)) { setError('Выберите банк для каждого скриншота.'); return; }
    if (chosen.some(o => !o.category.trim() || !Number.isFinite(o.percentage) || o.percentage < 0 || o.percentage > 100)) { setError('Проверьте категории и проценты.'); return; }
    if (mode === 'arrange' && banks.some(b => chosen.filter(o => o.bankId === b.id).length > (limits[b.id] ?? 0))) { setError('Превышен лимит категорий одного из банков.'); return; }
    const keys = chosen.map(o => `${o.bankId}:${o.category.trim().toLocaleLowerCase('ru')}:${(o.name.trim() || o.category.trim()).toLocaleLowerCase('ru')}`);
    if (new Set(keys).size !== keys.length) { setError('Одинаковое предложение добавлено несколько раз.'); return; }
    if (chosen.some(o => entries.some(e => e.bank_id === o.bankId && e.category_name.toLocaleLowerCase('ru') === o.category.trim().toLocaleLowerCase('ru') && (e.offer_name || '').toLocaleLowerCase('ru') === (o.name.trim() || o.category.trim()).toLocaleLowerCase('ru'))) && !confirm('Некоторые категории уже сохранены за этот месяц. Обновить их?')) return;
    setBusy('Сохраняем…'); setError('');
    try {
      let all = [...categories];
      for (const o of chosen) {
        let cat = all.find(c => c.name.toLocaleLowerCase('ru') === o.category.trim().toLocaleLowerCase('ru'));
        if (!cat) { cat = await apiCategories.create(o.category.trim()); all = [...all, cat]; }
        await apiCashback.create({ bank_id: o.bankId, category_id: cat.id, percentage: o.percentage, month: month.month, year: month.year, offer_name: o.name.trim() || o.category.trim(), notes: o.notes });
        if (o.suggestedCategory !== undefined && o.name.trim() && o.category.trim().toLocaleLowerCase('ru') !== o.suggestedCategory.trim().toLocaleLowerCase('ru')) await saveCorrection(o.bankId, cat.id, o.name.trim());
        setOffers(old => old.filter(x => x.id !== o.id));
      }
      await refresh(); setOffers([]); setPhotos([]); setScreen('home');
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
        <div className="cards">{grouped.map(([name, rows]) => { const sorted = [...rows].sort((a,b) => b.percentage-a.percentage || bankPriority(a.bank_name)-bankPriority(b.bank_name)); return <article className="cash-card" key={name}><div className="card-main"><CategoryMark name={name}/><div className="card-title"><h3>{name}</h3></div><BankMark name={sorted[0].bank_name}/><strong className={`rate ${rateClass(sorted[0].percentage)}`}>{fmt(sorted[0].percentage)}<small>%</small></strong></div><div className="card-details">{sorted.map(e => <div key={e.id}><span>{e.bank_name} · {fmt(e.percentage)}% {e.offer_name && e.offer_name.toLocaleLowerCase('ru') !== name.toLocaleLowerCase('ru') && `· ${e.offer_name}`} {e.notes && `— ${e.notes}`}</span><button onClick={async () => { if (confirm('Удалить этот кэшбэк?')) { try { await apiCashback.delete(e.id); await refresh(); } catch (err) { setError((err as Error).message); } } }} aria-label={`Удалить ${e.bank_name}`}>×</button></div>)}</div></article>; })}</div>
        {!grouped.length && !error && <div className="empty"><span>✳</span><h3>Пока ничего нет</h3><p>Добавьте категории или скриншоты.</p><button className="primary" onClick={() => { setMonthIndex(monthIndex === 0 ? 1 : monthIndex); setScreen('add'); }}>Добавить кэшбэк</button></div>}
        </>}
      {screen === 'add' && <><h1>Добавить</h1>
        <div className="segment"><button className={mode === 'selected' ? 'active' : ''} onClick={() => setMode('selected')}>Уже выбраны</button><button className={mode === 'arrange' ? 'active' : ''} onClick={() => setMode('arrange')}>Помочь выбрать</button></div>
        <div className="panel"><label>Месяц<select value={monthIndex === 0 ? 1 : monthIndex} onChange={e => setMonthIndex(Number(e.target.value))}><option value={1}>{months[1].label}</option><option value={2}>{months[2].label}</option></select></label></div>
        <section className="panel" aria-label="Скриншоты">
          <div className="upload-heading"><strong>Скриншоты</strong><span aria-live="polite">Выбрано: {pendingFiles.length}</span></div>
          <label className="upload"><span>＋</span><strong>{pendingFiles.length ? 'Добавить ещё фото' : 'Выбрать фото'}</strong><small>JPEG, PNG, WebP · до 3,5 МБ каждое</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ''; if (files.length) { setPendingFiles(old => [...old, ...files]); setError(''); } }} disabled={!!busy}/></label>
          {pendingFiles.length > 0 && <div className="pending-files">{pendingFiles.map((file, i) => <div key={`${file.name}-${i}`}><span>{file.name}</span><button type="button" aria-label={`Удалить ${file.name}`} disabled={!!busy} onClick={() => setPendingFiles(old => old.filter((_, index) => index !== i))}>×</button></div>)}</div>}
          <button className="primary" disabled={!!busy || !pendingFiles.length} onClick={() => upload(pendingFiles)}>Распознать{pendingFiles.length > 0 && ` · ${pendingFiles.length}`}</button>
          {busy && <p className="busy" role="status">{busy}</p>}
        </section>
        <details className="panel manual-panel"><summary>Добавить вручную</summary><div className="manual-content"><div className="bank-field"><span>Банк</span><BankPicker banks={banks} value={bankId} onChange={setBankId}/></div><button className="secondary" onClick={() => { const o: Offer = { id: uid(), bankId, name: '', category: '', percentage: 0, notes: '', selected: true }; setOffers(old => [...old, o]); setReviewBank(bankId); }} disabled={!bankId}>＋ Добавить кэшбэк</button></div></details>
        {photos.length > 0 && <div className="panel"><strong>Банк на скриншоте</strong>{photos.map(photo => <div className="bank-field" key={photo.id}><span>{photo.name}</span><BankPicker banks={banks} value={photo.bankId} onChange={id => { setPhotos(old => old.map(p => p.id === photo.id ? { ...p, bankId: id } : p)); setOffers(old => old.map(o => o.photoId === photo.id ? { ...o, bankId: id } : o)); setReviewBank(id); }}/><small className="hint">{photo.suggestedBankId ? `Предположение: ${banks.find(b => b.id === photo.suggestedBankId)?.name ?? 'неизвестно'}` : 'Модель не определила банк'}</small></div>)}</div>}
        {offers.length > 0 && <><div className="section-line"><div><h2>Проверка <span className="count">{offers.length}</span></h2></div></div>{mode === 'arrange' && <><p className="hint">Проверьте категории и распределите по лимитам банков.</p><button className="secondary" onClick={distribute}>✦ Распределить предложения</button></>}
          <div className="bank-tabs">{offers.some(o => !o.bankId) && <button className={reviewBank === 0 ? 'active' : ''} onClick={() => setReviewBank(0)}>Без банка</button>}{banks.filter(b => offers.some(o => o.bankId === b.id)).map(b => <button className={reviewBank === b.id ? 'active' : ''} key={b.id} onClick={() => setReviewBank(b.id)}>{b.name} · {offers.filter(o => o.bankId === b.id && o.selected).length}</button>)}</div>
          {current.map(o => <div className="review-card" key={o.id}><div className="review-head"><label className="check"><input type="checkbox" checked={o.selected} onChange={e => edit(o.id, { selected: e.target.checked })}/> Выбрать</label><button onClick={() => setOffers(old => old.filter(x => x.id !== o.id))}>Удалить ×</button></div><label>Название в банке<input value={o.name} onChange={e => edit(o.id, { name: e.target.value })} placeholder="Например, Супермаркеты"/></label><div className="fields"><label>Категория<input list="categories" value={o.category} onChange={e => edit(o.id, { category: e.target.value })} placeholder="Выберите или создайте"/></label><label>Кэшбэк, %<input type="number" min="0" max="100" step="0.1" value={o.percentage} onChange={e => edit(o.id, { percentage: Number(e.target.value) })}/></label></div><label>Условия и заметки<input value={o.notes} onChange={e => edit(o.id, { notes: e.target.value })} placeholder="Лимит, условия начисления…"/></label></div>)}<datalist id="categories">{categories.map(c => <option value={c.name} key={c.id}/>)}</datalist><button className="primary full" disabled={!!busy} onClick={save}>Сохранить выбранные · {offers.filter(o => o.selected).length}</button></>}</>}
      {screen === 'banks' && <><h1>Банки</h1><div className="panel"><strong>Напоминания</strong><p className="hint">В последний день месяца</p>{push.state === 'unsupported' ? <p className="hint">Уведомления не поддерживаются на этом устройстве.</p> : push.state === 'denied' ? <p className="hint">Разрешите уведомления в настройках устройства.</p> : <div className="push-actions"><button className="secondary" disabled={push.state === 'loading'} onClick={async () => { try { if (push.state === 'subscribed') await push.unsubscribe(); else await push.subscribe(); setPushMessage(''); } catch (e) { setPushMessage((e as Error).message); } }}>{push.state === 'loading' ? 'Загрузка…' : push.state === 'subscribed' ? 'Выключить' : 'Включить'}</button>{push.state === 'subscribed' && <button className="secondary" onClick={async () => { try { const endpoint = await push.getEndpoint(); if (!endpoint) throw new Error('Подписка не найдена'); await apiPush.test(endpoint); setPushMessage('Тестовое уведомление отправлено'); } catch (e) { setPushMessage((e as Error).message); } }}>Проверить</button>}</div>}{pushMessage && <p className="hint" role="status">{pushMessage}</p>}</div><div className="cards">{banks.map(b => <div className="bank-row" key={b.id}><BankMark name={b.name} size="large"/><div><strong>{b.name}</strong><p>Лимит категорий</p></div><input type="number" min="0" max="50" defaultValue={b.selection_limit ?? 3} aria-label={`Лимит ${b.name}`} onBlur={async e => { try { await apiBanks.update(b.id, { selection_limit: Number(e.target.value) }); await refresh(); } catch (err) { setError((err as Error).message); } }}/></div>)}</div><div className="panel"><label>Новый банк<input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Название банка"/></label><button className="secondary" onClick={async () => { try { await apiBanks.create(bankName); setBankName(''); await refresh(); } catch (e) { setError((e as Error).message); } }} disabled={!bankName.trim()}>Добавить банк</button></div></>}
    </main><nav className="bottom"><button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}><span>◫</span>Кэшбэки</button><button className={screen === 'add' ? 'active' : ''} onClick={() => { if (monthIndex === 0) setMonthIndex(1); setScreen('add'); }}><span>⊕</span>Добавить</button><button className={screen === 'banks' ? 'active' : ''} onClick={() => setScreen('banks')}><span>◈</span>Банки</button></nav></div>;
}
