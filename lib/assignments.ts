import type { Member } from "./types";

export const ASSIGNMENT_WINDOW_DAYS = 90;

export const calculateAge = (member: Member): number => {
  if (member.dateOfBirth) {
    const dob = new Date(member.dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      let age = now.getUTCFullYear() - dob.getUTCFullYear();
      const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
        age -= 1;
      }
      return age;
    }
  }
  return member.age;
};

export const getAssignmentDaysLeft = (member: Member): number | null => {
  if (!member.assignmentExpiresAt) return null;
  const expires = new Date(member.assignmentExpiresAt).getTime();
  if (Number.isNaN(expires)) return null;
  const diffMs = expires - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const getAssignmentDaysElapsed = (member: Member): number | null => {
  if (!member.assignmentStartDate) return null;
  const start = new Date(member.assignmentStartDate).getTime();
  if (Number.isNaN(start)) return null;
  const diffMs = Date.now() - start;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const isAssignmentExpired = (member: Member): boolean => {
  const daysLeft = getAssignmentDaysLeft(member);
  return daysLeft !== null && daysLeft < 0;
};

export const isAssignmentExpiringSoon = (member: Member, threshold = 14): boolean => {
  const daysLeft = getAssignmentDaysLeft(member);
  return daysLeft !== null && daysLeft >= 0 && daysLeft <= threshold;
};

export const computeAssignmentExpiration = (startIso: string): string => {
  const start = new Date(startIso);
  start.setUTCDate(start.getUTCDate() + ASSIGNMENT_WINDOW_DAYS);
  return start.toISOString();
};

/**
 * Effective status that accounts for expired assignments without requiring a stored mutation.
 * Used in UI rendering to show "Assignment Expired" if the 90-day window has lapsed.
 */
export const getEffectiveStatus = (member: Member) => {
  if (member.status === "Assigned / Pending Forum Review" && isAssignmentExpired(member)) {
    return "Assignment Expired" as const;
  }
  return member.status;
};
