export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cloud">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-card">
        <div className="mb-4 h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 space-y-2">
          <div className="h-3 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
