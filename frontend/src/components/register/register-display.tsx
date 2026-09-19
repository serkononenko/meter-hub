"use client";

import * as React from "react";
import Box from "@mui/material/Box";

/**
 * Mechanical register display: a reading rendered as odometer digit plates
 * with a red decimal tile, like the counter on a real meter. Digits roll in
 * on mount (one orchestrated moment); suppressed under reduced motion.
 *
 * Reusable for real readings in the Reading UI (7.5) — pass `value` as the
 * whole register string including the decimal digit.
 */

const DIGIT_PLATES = 8;

export interface RegisterDisplayProps {
  /** Register digits, e.g. "0043187" — the last digit is the decimal one. */
  value?: string;
  /** Tile height in px. */
  size?: number;
}

export function RegisterDisplay({value = "0043187", size = 56}: RegisterDisplayProps): React.JSX.Element {
  const digits = React.useMemo(() => {
    const digitsOnly = value.replace(/\D/g, "") || "0";
    return digitsOnly.slice(-DIGIT_PLATES).padStart(DIGIT_PLATES, "0").split("");
  }, [value]);

  return (
    <Box
      aria-label={`Register reading ${value}`}
      role="img"
      sx={{
        display: "inline-flex",
        alignSelf: "flex-start",
        gap: "4px",
        p: "10px",
        borderRadius: "10px",
        backgroundColor: "#05080d",
        boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.8), 0 1px 0 rgba(255, 255, 255, 0.06)",
        fontFamily: "var(--font-spline-mono), monospace",
        fontWeight: 600,
      }}
    >
      {digits.map((digit, index) => {
        const decimal = index === digits.length - 1;
        return (
          <Box
            key={index}
            sx={{
              position: "relative",
              overflow: "hidden",
              width: `${size / 1.55}px`,
              height: size,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.58,
              lineHeight: 1,
              borderRadius: "5px",
              color: decimal ? "#ff8589" : "#f2f5f7",
              backgroundColor: decimal ? "#3a1114" : "#10161f",
              border: "1px solid",
              borderColor: decimal ? "rgba(229, 72, 77, 0.45)" : "rgba(255, 255, 255, 0.07)",
              // Roller seam: the horizontal split of a mechanical drum.
              "&::after": {
                content: '""',
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                height: "1px",
                backgroundColor: "rgba(0, 0, 0, 0.55)",
              },
              ...(decimal && {
                // Red drums on real registers sit slightly recessed.
                boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.5)",
              }),
            }}
          >
            <Box
              component="span"
              sx={{
                display: "block",
                transform: "translateY(0)",
                animation: "register-roll 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
                animationDelay: `${index * 60}ms`,
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                },
              }}
            >
              {digit}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
