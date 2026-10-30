// Single source of truth: colors, easings, springs, fonts. Matches the board's Coral theme.
import { Easing } from "remotion";
import { loadFont as loadHanken } from "@remotion/google-fonts/HankenGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";

const hanken = loadHanken("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const theme = {
  colors: {
    bg: "#EFE9E2", // felt desk
    bgAlt: "#F7F3EE", // paper
    cotton: "#FCFAF7",
    ink: "#2A221E",
    inkSoft: "#4A403A",
    dim: "#7A6E66",
    rule: "#DDD4CB",
    primary: "#C9603F", // coral, THE hero: one element per frame
    accent: "#4A3B6B", // plum, sparing second
    glow: "rgba(201, 96, 63, 0.35)",
    shade: "rgba(74, 52, 38, 0.28)",
  },
  fonts: {
    display: hanken.fontFamily,
    body: hanken.fontFamily,
    mono: mono.fontFamily,
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
} as const;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
