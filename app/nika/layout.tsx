import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nika admin",
  robots: { index: false, follow: false },
};

export default function NikaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
