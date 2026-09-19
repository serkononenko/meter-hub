import {Bricolage_Grotesque, Spline_Sans_Mono} from "next/font/google";

/**
 * MeterHub typefaces. Bricolage Grotesque carries display and UI text;
 * Spline Sans Mono is reserved for register digits, serial numbers, and
 * other metering data. Wired into the theme via CSS variables.
 */
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bricolage",
});

export const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-spline-mono",
});
