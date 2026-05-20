import { MemberDetailWorkbench } from "@/components/member-detail-workbench";

export default async function MemberDetailPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  return <MemberDetailWorkbench memberId={memberId} />;
}
