import type { Metadata } from "next";
import "./globals.css";
import { Provider } from "@/components/Provider";
import { Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/toaster"

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-sans",
  display: 'swap',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900']
});

export const metadata: Metadata = {
  title: "CyberPatriots Projecter View Scoreboard",
  description: "An auto-updating scoreboard viewer for mulitple teams in CyberPatriots, built with Next.js and TypeScript.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.className} antialiased dark`}
      >
        <Provider>
          {children}
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
