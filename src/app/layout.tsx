import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "./providers";

const geistSans = { variable: '--font-geist-sans' }; /*
  variable: "--font-geist-sans",
  subsets: ["latin"],
*/

const geistMono = { variable: '--font-geist-mono' }; /*
  variable: "--font-geist-mono",
  subsets: ["latin"],
*/

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "OmniPOS",
  description: "Sistema de Punto de Venta (POS)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
