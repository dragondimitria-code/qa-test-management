import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QA Test Management",
  description: "Smoke and Sanity Test Case Management"
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}