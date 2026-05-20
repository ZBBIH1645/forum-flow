import Link from "next/link";
import { MemberForm } from "@/components/member-form";
import { PrivacyNote } from "@/components/privacy-note";

export default function NewMemberPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link href="/members" className="text-sm font-semibold text-eo-blue">Back to members</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Add member</h1>
        <p className="mt-2 text-sm text-muted">Create a member record that immediately feeds placement workflows.</p>
      </div>
      <MemberForm />
      <PrivacyNote />
    </div>
  );
}
