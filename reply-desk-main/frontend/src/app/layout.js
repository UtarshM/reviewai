import { Lora, Outfit } from "next/font/google";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata = {
  title: "Reply Desk — AI-Assisted Review Management",
  description: "AI-assisted replies and custom review generators for your business",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${lora.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
