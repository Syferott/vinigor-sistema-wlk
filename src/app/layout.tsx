import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VINIGOR · Gestão",
    template: "%s · VINIGOR",
  },
  description: "Sistema de gestão de serviços da VINIGOR Gráfica.",
};

export const viewport: Viewport = {
  themeColor: "#8cc63e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
