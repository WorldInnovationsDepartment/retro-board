// Invented demo cards, the same set the board screenshots use.
export const CARDS: { id: string; col: string; text: string; group: number }[] = [
  { id: "c6", col: "stop", text: "Changing scope mid-sprint", group: 0 },
  { id: "c8", col: "stop", text: "Adding tickets after planning", group: 0 },
  { id: "c16", col: "stop", text: "Last-minute asks from sales", group: 0 },
  { id: "c1", col: "start", text: "Acceptance criteria before the sprint", group: 1 },
  { id: "c9", col: "stop", text: "Starting with open product questions", group: 1 },
  { id: "c7", col: "stop", text: "Calls without an agenda", group: 2 },
  { id: "c10", col: "stop", text: "30-minute standups", group: 2 },
  { id: "c14", col: "continue", text: "Async updates over status calls", group: 2 },
  { id: "c4", col: "start", text: "QA freeze three days before release", group: 3 },
  { id: "c11", col: "continue", text: "Fast CI on every PR", group: 3 },
  { id: "c12", col: "continue", text: "QA reviewing criteria early", group: 3 },
  { id: "c2", col: "start", text: "Demo work in progress on Fridays", group: 4 },
  { id: "c5", col: "start", text: "Screen recordings on PRs", group: 4 },
  { id: "c13", col: "continue", text: "Sharing AI tricks in #dev", group: 4 },
];

export const GROUPS = [
  "Scope changes after planning",
  "Clear requirements up front",
  "Meetings that eat focus",
  "Release and QA timing",
  "Sharing how we work",
];

// Deterministic pseudo-random scatter for the "chaos" pile.
export const scatter = (i: number) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: 360 + r(1) * 1000, y: 260 + r(2) * 470, rot: (r(3) - 0.5) * 28 };
};
