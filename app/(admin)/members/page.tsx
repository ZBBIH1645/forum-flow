import { MemberDirectory } from "@/components/member-directory";
import { PrivacyNote } from "@/components/privacy-note";

export default function MembersPage() {
  return (
    <>
      <MemberDirectory />
      <div className="px-4 pb-6 sm:px-6 lg:px-8">
        <PrivacyNote />
      </div>
    </>
  );
}
