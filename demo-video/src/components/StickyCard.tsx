import React from "react";
import { theme } from "../theme";

export const COLUMN_TINT: Record<string, string> = { start: "#E9DFC9", stop: "#EBD3C8", continue: "#D9DECF" };

// A cotton-stock index card, matching the board's card surface.
export const StickyCard: React.FC<{ text: string; col: string; width?: number; style?: React.CSSProperties }> = ({ text, col, width = 300, style }) => (
  <div
    style={{
      width,
      padding: "16px 18px",
      borderRadius: 10,
      background: theme.colors.cotton,
      borderTop: `5px solid ${COLUMN_TINT[col]}`,
      boxShadow: `0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px ${theme.colors.rule}, 10px 10px 20px -10px ${theme.colors.shade}`,
      color: theme.colors.ink,
      fontFamily: theme.fonts.body,
      fontSize: 22,
      lineHeight: 1.3,
      fontWeight: 500,
      ...style,
    }}
  >
    <div style={{ fontSize: 14, color: theme.colors.dim, marginBottom: 6, fontWeight: 500, textTransform: "capitalize" }}>{col}</div>
    {text}
  </div>
);
