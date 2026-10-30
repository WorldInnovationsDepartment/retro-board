import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, theme } from "../theme";
import { Entrance, SceneShell, WordReveal } from "../components/layers";
import { StickyCard } from "../components/StickyCard";
import { CARDS, GROUPS, scatter } from "../data";

const headline: React.CSSProperties = {
  fontFamily: theme.fonts.display,
  fontWeight: 650,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  color: theme.colors.ink,
};

// ---------- 1. Hook: the pile nobody can read ----------
export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const swap = Math.round(fps * 3.1);
  const firstOut = interpolate(frame, [swap - 8, swap], [1, 0], { ...clamp, easing: theme.ease.in });
  return (
    <SceneShell enter={false}>
      {CARDS.map((c, i) => {
        const s = scatter(i);
        const p = spring({ frame: frame - 6 - i * 3, fps, config: theme.spring.bouncy });
        const breathe = Math.sin((frame + i * 9) / 26) * 2;
        return (
          <div key={c.id} style={{ position: "absolute", left: s.x, top: s.y + interpolate(p, [0, 1], [-260, 0]) + breathe, opacity: p, transform: `rotate(${s.rot * p}deg) scale(${interpolate(p, [0, 1], [1.15, 1])})`, zIndex: i }}>
            <StickyCard text={c.text} col={c.col} width={290} />
          </div>
        );
      })}
      <AbsoluteFill style={{ padding: "84px 110px", justifyContent: "flex-start", zIndex: 50 }}>
        <div style={{ background: `${theme.colors.bg}e8`, padding: "18px 26px", borderRadius: 14, alignSelf: "flex-start", boxShadow: `0 20px 40px -24px ${theme.colors.shade}` }}>
          {frame < swap ? (
            <div style={{ opacity: firstOut }}>
              <WordReveal text="Fifteen people. A few dozen cards. One canvas." delay={4} style={{ ...headline, fontSize: 64 }} />
            </div>
          ) : (
            <WordReveal text="No tool I tried groups them by meaning." delay={0} hero="meaning" style={{ ...headline, fontSize: 64 }} />
          )}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

// ---------- 2. The turn: an artifact with a backend ----------
const CAPS = [
  ["db", "shared data, live for everyone"],
  ["room", "who has the board open"],
  ["user", "who's who, who hosts"],
  ["sample", "the page asks Claude"],
];
export const TurnScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <SceneShell>
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", gap: 64 }}>
        <WordReveal text="So I built one inside a Claude artifact." delay={4} hero="artifact" style={{ ...headline, fontSize: 84, maxWidth: 1400 }} />
        <div style={{ display: "flex", gap: 28 }}>
          {CAPS.map(([name, what], i) => (
            <Entrance key={name} delay={26 + i * 5}>
              <div style={{ width: 380, padding: "26px 28px", borderRadius: 14, background: theme.colors.cotton, boxShadow: `0 0 0 1px ${theme.colors.rule}, 12px 12px 24px -12px ${theme.colors.shade}`, transform: `translateY(${Math.sin((frame + i * 20) / 30) * 3}px)` }}>
                <div style={{ fontFamily: theme.fonts.mono, fontSize: 34, color: theme.colors.ink }}>{name}</div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: 24, color: theme.colors.dim, marginTop: 8 }}>{what}</div>
              </div>
            </Entrance>
          ))}
        </div>
        <Entrance delay={54}>
          <div style={{ fontFamily: theme.fonts.body, fontSize: 30, color: theme.colors.inkSoft }}>No server. No hosting. One HTML file.</div>
        </Entrance>
      </AbsoluteFill>
    </SceneShell>
  );
};

// ---------- 3. Screenshot beats ----------
export const ShotScene: React.FC<{ src: string; step: string; title: string; sub: string; zoomIn?: boolean; origin?: string }> = ({ src, step, title, sub, zoomIn = true, origin = "50% 30%" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const kb = interpolate(frame, [0, durationInFrames], zoomIn ? [1, 1.09] : [1.09, 1], { ...clamp, easing: theme.ease.inOut });
  const pan = interpolate(frame, [0, durationInFrames], [0, -22], { ...clamp, easing: theme.ease.inOut });
  const card = spring({ frame: frame - 4, fps, config: theme.spring.smooth });
  return (
    <SceneShell>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 80px 0 110px", gap: 60 }}>
        <div style={{ width: 400, flex: "none", display: "flex", flexDirection: "column", gap: 18 }}>
          <Entrance delay={2}>
            <div style={{ fontFamily: theme.fonts.mono, fontSize: 26, color: theme.colors.dim }}>{step}</div>
          </Entrance>
          <WordReveal text={title} delay={6} style={{ ...headline, fontSize: 58 }} />
          <Entrance delay={16}>
            <div style={{ fontFamily: theme.fonts.body, fontSize: 27, lineHeight: 1.4, color: theme.colors.inkSoft }}>{sub}</div>
          </Entrance>
        </div>
        <div
          style={{
            width: 1290,
            height: 806,
            flex: "none",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: `0 0 0 1px ${theme.colors.rule}, 24px 30px 60px -28px rgba(60,40,30,0.45)`,
            opacity: card,
            transform: `translateX(${interpolate(card, [0, 1], [80, 0])}px) scale(${interpolate(card, [0, 1], [0.96, 1])})`,
          }}
        >
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", transformOrigin: origin, transform: `scale(${kb}) translateX(${pan}px)` }} />
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

// ---------- 4. Signature: Group with AI ----------
export const GroupingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const press = Math.round(fps * 1.1);
  const flyStart = press + Math.round(fps * 0.6);
  const btnP = spring({ frame: frame - 4, fps, config: theme.spring.snappy });
  const pressed = interpolate(frame, [press, press + 4, press + 10], [1, 0.92, 1], { ...clamp, easing: theme.ease.out });
  const btnOut = interpolate(frame, [flyStart + 30, flyStart + 42], [1, 0], { ...clamp, easing: theme.ease.in });
  const colX = (g: number) => 110 + g * 345;
  const counts = [0, 0, 0, 0, 0];
  return (
    <SceneShell>
      {GROUPS.map((title, g) => {
        const p = spring({ frame: frame - flyStart - 6 - g * 5, fps, config: theme.spring.smooth });
        return (
          <div key={title} style={{ position: "absolute", left: colX(g), top: 250, width: 320, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px)` }}>
            <div style={{ ...headline, fontSize: 30, lineHeight: 1.15, minHeight: 72 }}>{title}</div>
            <div style={{ height: 2, background: theme.colors.rule, marginTop: 10, width: `${p * 100}%` }} />
          </div>
        );
      })}
      {CARDS.map((c, i) => {
        const s = scatter(i);
        const slot = counts[c.group]++;
        const p = spring({ frame: frame - flyStart - i * 2, fps, config: theme.spring.smooth });
        const x = interpolate(p, [0, 1], [s.x, colX(c.group)]);
        const y = interpolate(p, [0, 1], [s.y, 350 + slot * 128]);
        const rot = interpolate(p, [0, 1], [s.rot, 0]);
        return (
          <div key={c.id} style={{ position: "absolute", left: x, top: y, transform: `rotate(${rot}deg)`, zIndex: 10 + i }}>
            <StickyCard text={c.text} col={c.col} width={interpolate(p, [0, 1], [290, 320])} style={{ fontSize: 21 }} />
          </div>
        );
      })}
      <AbsoluteFill style={{ padding: "84px 110px", zIndex: 60, justifyContent: "flex-start", flexDirection: "row", alignItems: "flex-start", gap: 36 }}>
        <div style={{ opacity: btnP * btnOut, transform: `scale(${interpolate(btnP, [0, 1], [0.9, 1]) * pressed})`, padding: "22px 36px", borderRadius: 12, background: theme.colors.primary, color: "#fff", fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 34, boxShadow: `0 0 60px ${theme.colors.glow}, 10px 12px 24px -12px ${theme.colors.shade}` }}>
          Group with AI
        </div>
        <div style={{ opacity: btnOut }}>
          <WordReveal text="One click. Claude reads every card." delay={press + 4} style={{ ...headline, fontSize: 46, marginTop: 14 }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: "80px 110px", zIndex: 59, justifyContent: "flex-start" }}>
        <div style={{ opacity: interpolate(frame, [flyStart + 40, flyStart + 54], [0, 1], { ...clamp, easing: theme.ease.out }) }}>
          <WordReveal text="Themes by meaning, across columns." delay={flyStart + 42} style={{ ...headline, fontSize: 56 }} />
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

// ---------- 5. Recap counters ----------
const Counter: React.FC<{ to: number; delay: number; suffix?: string }> = ({ to, delay, suffix = "" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = interpolate(spring({ frame: frame - delay, fps, config: { damping: 30, stiffness: 60 } }), [0, 1], [0, to]);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(v)}{suffix}</span>;
};
export const RecapScene: React.FC = () => {
  const stats: [number, string, string][] = [
    [1, "", "HTML file, about 85 KB"],
    [4, "", "artifact capabilities"],
    [35, "", "requirements in the spec"],
    [15, "", "unit tests on the rules"],
  ];
  return (
    <SceneShell>
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", gap: 70 }}>
        <WordReveal text="One session with Claude Code. Spec first." delay={4} hero="Spec" style={{ ...headline, fontSize: 80 }} />
        <div style={{ display: "flex", gap: 70 }}>
          {stats.map(([n, suf, label], i) => (
            <Entrance key={label} delay={22 + i * 6}>
              <div style={{ fontFamily: theme.fonts.mono, fontSize: 110, color: theme.colors.ink, lineHeight: 1 }}>
                <Counter to={n} delay={22 + i * 6} suffix={suf} />
              </div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 26, color: theme.colors.dim, marginTop: 12, maxWidth: 290 }}>{label}</div>
            </Entrance>
          ))}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

// ---------- 6. End card ----------
export const EndScene: React.FC = () => {
  const frame = useCurrentFrame();
  const breathe = 1 + Math.sin(frame / 22) * 0.008;
  return (
    <SceneShell>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 28 }}>
        <div style={{ transform: `scale(${breathe})` }}>
          <WordReveal text="The retro tool I couldn’t buy." delay={4} per={4} hero="couldn’t" style={{ ...headline, fontSize: 104, justifyContent: "center" }} />
        </div>
        <Entrance delay={26}>
          <div style={{ fontFamily: theme.fonts.body, fontSize: 32, color: theme.colors.inkSoft }}>The spec to build yours is in the post.</div>
        </Entrance>
        <Entrance delay={34}>
          <div style={{ fontFamily: theme.fonts.mono, fontSize: 26, color: theme.colors.dim }}>danylovorvul.com</div>
        </Entrance>
      </AbsoluteFill>
    </SceneShell>
  );
};
