import { AppShell } from "@/components/app-shell";

// SECURITY: This admin route group has NO authentication gate. The app is a
// localStorage-only demo with no backend. Before deploying anywhere reachable
// from the public internet, add a real auth check here (e.g. middleware that
// verifies a session and redirects unauthenticated requests). See README.md.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
