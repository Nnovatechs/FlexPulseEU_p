import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlexPulseEU",
  description:
    "Professional project foundation for future population surveys and semantic mapping capabilities.",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
