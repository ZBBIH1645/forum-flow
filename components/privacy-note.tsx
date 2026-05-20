import { ShieldCheck } from "lucide-react";

export function PrivacyNote() {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-white p-4 text-sm text-muted shadow-card">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-eo-teal" />
      <p>
        <span className="font-semibold text-ink">Privacy note:</span> ForumFlow supports placement and administration only.
        It does not record, summarize, or analyze confidential Forum conversations.
      </p>
    </div>
  );
}
