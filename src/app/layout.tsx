import type { Metadata } from "next";
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
        {children}
      </body>
    </html>
  );
}
