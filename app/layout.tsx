import type { Metadata } from "next";
import { LiveDataProvider } from "@/components/live-data-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forum Placement Dashboard",
  description: "Internal placement workbench for assigning members to Forum groups."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LiveDataProvider>{children}</LiveDataProvider>
      </body>
    </html>
  );
}
