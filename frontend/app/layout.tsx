import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Image from "next/image";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Encrypted Employee Satisfaction Survey",
  description: "Privacy-preserving employee satisfaction survey using FHEVM",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <main className="flex flex-col max-w-screen-lg mx-auto pb-20">
          <Header />
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
