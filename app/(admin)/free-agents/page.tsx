import { MemberDirectory } from "@/components/member-directory";
import { PrivacyNote } from "@/components/privacy-note";

export default function FreeAgentsPage() {
  return (
    <>
      <MemberDirectory
        title="Free agents"
        subtitle="Review members who need placement, missing information, or conflict review."
        defaultAssignment="Free Agents"
      />
      <div className="px-4 pb-6 sm:px-6 lg:px-8">
        <PrivacyNote />
      </div>
    </>
  );
}
