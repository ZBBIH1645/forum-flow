import type { ForumGroup, Member } from "./types";

export type DatabaseTables = {
  members: Member;
  forums: ForumGroup;
};

export const supabaseTableNames = {
  members: "members",
  forums: "forums"
} as const;
