import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, Series, staticFile } from "remotion";
import { BgMesh, Grade, Grain, Vignette } from "./components/layers";
import { EndScene, GroupingScene, HookScene, RecapScene, ShotScene, TurnScene } from "./scenes/scenes";

const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);

type Beat = { len: number; sfx?: "whoosh" | "thump"; el: React.ReactNode };
const BEATS: Beat[] = [
  { len: s(6), el: <HookScene /> },
  { len: s(4.2), sfx: "whoosh", el: <TurnScene /> },
  { len: s(3.4), sfx: "whoosh", el: <ShotScene src="shots/lobby.png" step="01" title="Join the lobby" sub="Last retro's actions open the meeting, with owners." zoomIn origin="40% 60%" /> },
  { len: s(3.6), sfx: "whoosh", el: <ShotScene src="shots/write.png" step="02" title="Write cards" sub="Anonymous. The board shows how many people are writing, never who." zoomIn={false} origin="50% 45%" /> },
  { len: s(6), sfx: "whoosh", el: <GroupingScene /> },
  { len: s(3.4), sfx: "whoosh", el: <ShotScene src="shots/grouped.png" step="03" title="The host fixes the rest" sub="Move, rename, merge. The model can't lose or rewrite a card." zoomIn origin="50% 40%" /> },
  { len: s(3.6), sfx: "whoosh", el: <ShotScene src="shots/vote.png" step="04" title="Vote" sub="Three anonymous votes each. Totals stay hidden until the reveal." zoomIn={false} origin="30% 30%" /> },
  { len: s(4), sfx: "thump", el: <ShotScene src="shots/results.png" step="05" title="Ranked themes" sub="Every card stays visible under its theme." zoomIn origin="20% 30%" /> },
  { len: s(3.6), sfx: "whoosh", el: <ShotScene src="shots/actions.png" step="06" title="Actions with owners" sub="Anyone writes them. Nobody leaves without an owner." zoomIn={false} origin="50% 50%" /> },
  { len: s(3), sfx: "whoosh", el: <ShotScene src="shots/history.png" step="07" title="History" sub="Every retro kept, open actions counted." zoomIn origin="30% 40%" /> },
  { len: s(4.2), sfx: "whoosh", el: <RecapScene /> },
  { len: s(3.6), sfx: "whoosh", el: <EndScene /> },
];
export const TOTAL = BEATS.reduce((a, b) => a + b.len, 0);

const RetroDemo: React.FC = () => {
  let at = 0;
  const cues = BEATS.map((b) => {
    const start = at;
    at += b.len;
    return { start, sfx: b.sfx };
  });
  return (
    <AbsoluteFill>
      <BgMesh />
      <Series>
        {BEATS.map((b, i) => (
          <Series.Sequence key={i} durationInFrames={b.len}>
            {b.el}
          </Series.Sequence>
        ))}
      </Series>
      <Grade />
      <Grain />
      <Vignette />
      <Audio src={staticFile("sfx/pad.wav")} volume={0.22} />
      {cues.map((c, i) =>
        c.sfx ? (
          <Sequence key={i} from={Math.max(0, c.start - 3)} durationInFrames={s(0.6)}>
            <Audio src={staticFile(`sfx/${c.sfx}.wav`)} volume={c.sfx === "thump" ? 0.7 : 0.35} />
          </Sequence>
        ) : null
      )}
      {/* cards landing in the hook, and the Group with AI press */}
      {Array.from({ length: 6 }, (_, i) => (
        <Sequence key={`t${i}`} from={6 + i * 7} durationInFrames={s(0.2)}>
          <Audio src={staticFile("sfx/tick.wav")} volume={0.25} />
        </Sequence>
      ))}
      <Sequence from={cues[4].start + s(1.1) - 2} durationInFrames={s(0.3)}>
        <Audio src={staticFile("sfx/pop.wav")} volume={0.6} />
      </Sequence>
      <Sequence from={cues[4].start + s(1.7) - 3} durationInFrames={s(0.6)}>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <Composition id="RetroDemo" component={RetroDemo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);
