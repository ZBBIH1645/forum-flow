import Link from "next/link";
import { getForumTone } from "@/lib/forum-colors";

type ForumBadgeProps = {
  forumId: string;
  name: string;
  href?: string;
  suffix?: string;
  size?: "xs" | "sm" | "md";
};

const sizes: Record<NonNullable<ForumBadgeProps["size"]>, string> = {
  xs: "px-2 py-0.5 text-[11px]",
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1 text-sm"
};

export function ForumBadge({ forumId, name, href, suffix, size = "sm" }: ForumBadgeProps) {
  const className = `inline-flex max-w-full items-center rounded-full font-semibold ring-1 ${sizes[size]} ${getForumTone(forumId)}`;
  const content = (
    <>
      <span className="truncate">{name}</span>
      {suffix ? <span className="ml-1 shrink-0 opacity-75">{suffix}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${className} transition hover:brightness-95`}>
        {content}
      </Link>
    );
  }

  return <span className={className}>{content}</span>;
}
