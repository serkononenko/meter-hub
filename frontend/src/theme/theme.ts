"use client";

import {createTheme} from "@mui/material/styles";

import {components} from "./component-styles";
import {colorSchemes} from "./palettes/color-schemes";
import {shadows} from "./shadows";

/**
 * MeterHub web theme, based on the Devias Kit (MIT license). Both color
 * schemes are enabled so the app follows the system preference;
 * `cssVariables` keeps palette values in CSS custom properties for stable
 * server-rendered output.
 */
const theme = createTheme({
  breakpoints: {values: {xs: 0, sm: 600, md: 900, lg: 1200, xl: 1440}},
  colorSchemes,
  components,
  cssVariables: {colorSchemeSelector: "data"},
  direction: "ltr",
  shadows,
  shape: {borderRadius: 8},
  typography: {
    fontFamily:
      'var(--font-bricolage), "Bricolage Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    body1: {fontSize: "1rem", fontWeight: 400, lineHeight: 1.5},
    body2: {fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.57},
    button: {fontWeight: 500},
    caption: {fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.66},
    subtitle1: {fontSize: "1rem", fontWeight: 500, lineHeight: 1.57},
    subtitle2: {fontSize: "0.875rem", fontWeight: 500, lineHeight: 1.57},
    overline: {
      fontSize: "0.75rem",
      fontWeight: 500,
      letterSpacing: "0.5px",
      lineHeight: 2.5,
      textTransform: "uppercase",
    },
    h1: {fontSize: "3.5rem", fontWeight: 500, lineHeight: 1.2},
    h2: {fontSize: "3rem", fontWeight: 500, lineHeight: 1.2},
    h3: {fontSize: "2.25rem", fontWeight: 500, lineHeight: 1.2},
    h4: {fontSize: "2rem", fontWeight: 500, lineHeight: 1.2},
    h5: {fontSize: "1.5rem", fontWeight: 500, lineHeight: 1.2},
    h6: {fontSize: "1.125rem", fontWeight: 500, lineHeight: 1.2},
  },
});

export default theme;
