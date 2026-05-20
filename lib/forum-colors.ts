const forumTones = [
  "bg-sky-50 text-sky-800 ring-sky-200",
  "bg-violet-50 text-violet-800 ring-violet-200",
  "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "bg-amber-50 text-amber-900 ring-amber-200",
  "bg-rose-50 text-rose-800 ring-rose-200",
  "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "bg-lime-50 text-lime-800 ring-lime-200",
  "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  "bg-orange-50 text-orange-800 ring-orange-200",
  "bg-indigo-50 text-indigo-800 ring-indigo-200",
  "bg-teal-50 text-teal-800 ring-teal-200",
  "bg-pink-50 text-pink-800 ring-pink-200",
  "bg-yellow-50 text-yellow-900 ring-yellow-200",
  "bg-blue-50 text-blue-800 ring-blue-200",
  "bg-green-50 text-green-800 ring-green-200",
  "bg-purple-50 text-purple-800 ring-purple-200",
  "bg-red-50 text-red-800 ring-red-200",
  "bg-slate-100 text-slate-700 ring-slate-200",
  "bg-stone-100 text-stone-800 ring-stone-200",
  "bg-zinc-100 text-zinc-800 ring-zinc-200",
  "bg-neutral-100 text-neutral-800 ring-neutral-200",
  "bg-emerald-100 text-emerald-900 ring-emerald-200",
  "bg-sky-100 text-sky-900 ring-sky-200",
  "bg-violet-100 text-violet-900 ring-violet-200"
];

export function getForumTone(forumId: string) {
  const match = forumId.match(/\d+/);
  const index = match ? Number(match[0]) - 1 : hashId(forumId);
  return forumTones[Math.abs(index) % forumTones.length];
}

function hashId(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
