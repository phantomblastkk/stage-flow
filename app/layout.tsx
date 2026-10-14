import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stage Flow — sua música, sua agenda",
  description: "Organize shows, conecte-se com produtores e divulgue seu trabalho musical em um só lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
