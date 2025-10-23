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
  title: "CyberPatriot Live Scoreboard View",
  description: "An auto-updating scoreboard viewer for multiple teams in CyberPatriot, built with Next.js and TypeScript. Helpful for coaches to put on a shared screen like a projector during competitions.",
  keywords: ['cyberpatriot scoreboard', 'live scoreboard', 'projector view', 'coach tool'],
  robots: "index, follow",
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
