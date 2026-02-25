import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Top5DOA",
  description: "Debate the greatest of all time across any category",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-white antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
