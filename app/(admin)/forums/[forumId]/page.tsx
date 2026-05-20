import { LiveForumDetail } from "@/components/live-forum-detail";

export default async function ForumDetailPage({ params }: { params: Promise<{ forumId: string }> }) {
  const { forumId } = await params;
  return <LiveForumDetail forumId={forumId} />;
}
