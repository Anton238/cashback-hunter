export type CategorySynonymsMap = Record<string, string[]>;

export function buildSynonymsMap(list: { category_name: string; synonym: string }[]): CategorySynonymsMap {
  const map: CategorySynonymsMap = {};
  for (const { category_name, synonym } of list) {
    const syn = synonym.trim();
    if (!syn) continue;
    if (!map[category_name]) map[category_name] = [];
    if (!map[category_name].includes(syn)) map[category_name].push(syn);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.localeCompare(b));
  }
  return map;
}

function buildReverseMap(map: CategorySynonymsMap): Map<string, string> {
  const reverse = new Map<string, string>();
  for (const [main, synonyms] of Object.entries(map)) {
    for (const syn of synonyms) {
      const key = syn.trim().toLowerCase();
      if (key) reverse.set(key, main);
    }
  }
  return reverse;
}

export function resolveCategoryName(name: string, map: CategorySynonymsMap): string {
  const trimmed = name.trim();
  if (!trimmed) return name;
  const reverse = buildReverseMap(map);
  const main = reverse.get(trimmed.toLowerCase());
  return main ?? trimmed;
}
