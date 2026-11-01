export type Offer = { id: string; bankId: number; category: string; percentage: number; notes: string; name: string; selected: boolean; suggestedCategory?: string; photoId?: string };

// Maximum coverage, then maximum total cashback, respecting bank capacities.
// Successive shortest augmenting paths allow earlier choices to be reassigned.
export function optimize(offers: Offer[], limits: Record<number, number>): Set<string> {
  const banks = [...new Set(offers.map(o => o.bankId))];
  const cats = [...new Set(offers.map(o => o.category.trim().toLocaleLowerCase('ru')))];
  type Edge = { to: number; rev: number; cap: number; cost: number; offer?: string };
  const source = 0, catStart = 1, bankStart = catStart + cats.length, sink = bankStart + banks.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const add = (from: number, to: number, cap: number, cost: number, offer?: string) => {
    graph[from].push({ to, rev: graph[to].length, cap, cost, offer });
    graph[to].push({ to: from, rev: graph[from].length - 1, cap: 0, cost: -cost });
  };
  cats.forEach((_, i) => { add(source, catStart + i, 1, -1000000); add(source, catStart + i, offers.length, 0); });
  banks.forEach((b, i) => add(bankStart + i, sink, Math.max(0, limits[b] ?? 0), 0));
  offers.forEach(o => add(catStart + cats.indexOf(o.category.trim().toLocaleLowerCase('ru')), bankStart + banks.indexOf(o.bankId), 1, -Math.round(o.percentage * 100), o.id));
  while (true) {
    const dist = Array(graph.length).fill(Infinity), prev: [number, number][] = [];
    dist[source] = 0;
    for (let k = 0; k < graph.length - 1; k++) {
      let changed = false;
      graph.forEach((edges, u) => edges.forEach((e, i) => { if (e.cap && dist[u] + e.cost < dist[e.to]) { dist[e.to] = dist[u] + e.cost; prev[e.to] = [u, i]; changed = true; } }));
      if (!changed) break;
    }
    if (!Number.isFinite(dist[sink]) || dist[sink] >= 0) break;
    for (let v = sink; v !== source;) { const [u, i] = prev[v]; const e = graph[u][i]; e.cap--; graph[v][e.rev].cap++; v = u; }
  }
  return new Set(graph.flat().filter(e => e.offer && e.cap === 0).map(e => e.offer!));
}
