import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/shared/AuthProvider";

const syne = Syne({
  subsets:  ["latin"],
  variable: "--font-syne",
  weight:   ["400","500","600","700","800"],
  display:  "swap",
  preload:  false,
});

const dmSans = DM_Sans({
  subsets:  ["latin"],
  variable: "--font-dm",
  weight:   ["300","400","500","600"],
  display:  "swap",
  preload:  false,
});

export const metadata = {
  title:       "Dana Shivam Heart & Super Speciality Hospital",
  description: "Dana Shivam Heart & Super Speciality Hospital, Jaipur — Spirit To Care, Skill To Heal.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${dmSans.variable} font-dm antialiased`}>
        <AuthProvider>
          <Toaster position="top-right" />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}