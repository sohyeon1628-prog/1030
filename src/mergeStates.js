// 이 기기의 기록(a)과 서버의 기록(b)을 합친다: 둘 중 더 나아간 쪽을 남기고, 편지함은 합집합으로 둔다(어느 쪽도 잃지 않는다).
const RANK = { rough: 1, safe: 2, perfect: 3 };
export function mergeStates(a, b) {
  if (!b) return a;
  const out = { ...a, ...b };
  out.delivered = { ...(a.delivered || {}), ...(b.delivered || {}) };
  out.grade = { ...(a.grade || {}) };
  for (const [id, g] of Object.entries(b.grade || {})) if (!out.grade[id] || RANK[g] > RANK[out.grade[id]]) out.grade[id] = g;
  out.orbs = { ...(a.orbs || {}) };
  for (const [id, n] of Object.entries(b.orbs || {})) out.orbs[id] = Math.max(out.orbs[id] || 0, n);
  out.orbExtra = Math.max(a.orbExtra || 0, b.orbExtra || 0);
  const byId = new Map();
  for (const m of [...(b.mine || []), ...(a.mine || [])]) { const p = byId.get(m.id); byId.set(m.id, p ? { ...p, ...m, share: m.share || p.share, reaction: m.reaction || p.reaction } : m); }
  out.mine = [...byId.values()].sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  for (const k of ["storySeen", "howtoSeen", "tutorialSeen", "practiceDone", "bottleSeen"]) out[k] = !!(a[k] || b[k]);
  out.muted = a.muted;
  return out;
}
