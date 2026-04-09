import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jordan admin",
  robots: { index: false, follow: false },
};

export default function JordanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
