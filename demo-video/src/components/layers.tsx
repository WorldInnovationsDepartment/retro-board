import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, theme } from "../theme";

export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 55) * 50;
  const d2 = Math.cos(frame / 70) * 40;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <div style={{ position: "absolute", width: 1300, height: 1300, borderRadius: "50%", top: -560, left: -380 + d1, filter: "blur(60px)", background: `radial-gradient(circle, ${theme.colors.cotton}, transparent 64%)` }} />
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", bottom: -420, right: -260 - d2, filter: "blur(80px)", background: `radial-gradient(circle, ${theme.colors.primary}1c, transparent 66%)` }} />
    </AbsoluteFill>
  );
};

export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: theme.colors.primary, mixBlendMode: "soft-light", opacity: 0.1 }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(60,40,30,0.06), transparent 28%, transparent 72%, rgba(60,40,30,0.12))" }} />
  </AbsoluteFill>
);

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px", backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`, opacity: 0.06, mixBlendMode: "multiply" }} />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 58%, rgba(60,40,30,0.18) 100%)" }} />
);

// Wraps a scene: scale-through entrance, faster exit.
export const SceneShell: React.FC<{ children: React.ReactNode; enter?: boolean }> = ({ children, enter = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = enter ? spring({ frame, fps, config: theme.spring.smooth }) : 1;
  const exitStart = durationInFrames - Math.round(fps * 0.35);
  const exitO = interpolate(frame, [exitStart, durationInFrames], [1, 0], { ...clamp, easing: theme.ease.in });
  const exitS = interpolate(frame, [exitStart, durationInFrames], [1, 1.04], { ...clamp, easing: theme.ease.in });
  return (
    <AbsoluteFill style={{ opacity: Math.min(p, exitO), transform: `scale(${interpolate(p, [0, 1], [0.97, 1]) * exitS})` }}>
      {children}
    </AbsoluteFill>
  );
};

export const Entrance: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties; rise?: number }> = ({ delay = 0, children, style, rise = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: theme.spring.smooth });
  return (
    <div style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [rise, 0])}px) scale(${interpolate(p, [0, 1], [0.95, 1])})`, ...style }}>
      {children}
    </div>
  );
};

export const WordReveal: React.FC<{ text: string; delay?: number; per?: number; style?: React.CSSProperties; hero?: string }> = ({ text, delay = 0, per = 3, style, hero }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: 18, rowGap: 4, ...style }}>
      {text.split(" ").map((word, i) => {
        const p = spring({ frame: frame - delay - i * per, fps, config: theme.spring.snappy });
        const isHero = hero && word.replace(/[.,]/g, "") === hero;
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`, color: isHero ? theme.colors.primary : undefined }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};
