import type {Components, Theme} from "@mui/material/styles";
import {tableCellClasses} from "@mui/material/TableCell";
import {tableRowClasses} from "@mui/material/TableRow";

/**
 * Component style overrides ported from the Devias Kit, restyled to the
 * meter-housing identity: cards are flat plates with a hairline border
 * (elevation is reserved for overlays), buttons and cards share the theme
 * radius, and display headings take the tighter tracking of a stamped
 * appliance nameplate.
 */
export const components: Components<Theme> = {
  MuiAvatar: {
    styleOverrides: {
      root: {fontSize: "14px", fontWeight: 600, letterSpacing: 0},
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {borderRadius: "8px", textTransform: "none"},
      sizeSmall: {padding: "6px 16px"},
      sizeMedium: {padding: "8px 20px"},
      sizeLarge: {padding: "11px 24px"},
    },
  },
  MuiCard: {
    styleOverrides: {
      root: ({theme}) => ({
        borderRadius: "12px",
        border: "1px solid var(--mui-palette-divider)",
        backgroundImage: "none",
        boxShadow: "none",
        ...(theme.palette.mode === "dark" && {
          backgroundColor: "var(--mui-palette-background-paper)",
        }),
      }),
    },
  },
  MuiCardContent: {
    styleOverrides: {
      root: {padding: "24px", "&:last-child": {paddingBottom: "24px"}},
    },
  },
  MuiCardHeader: {
    styleOverrides: {root: {padding: "24px 24px 12px"}},
  },
  MuiChip: {
    styleOverrides: {
      root: {borderRadius: "6px", fontWeight: 500},
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {backgroundImage: "none"},
    },
  },
  MuiLink: {defaultProps: {underline: "hover"}},
  MuiPaper: {
    styleOverrides: {
      root: {backgroundImage: "none"},
    },
  },
  MuiStack: {defaultProps: {useFlexGap: true}},
  MuiTab: {
    styleOverrides: {
      root: {
        fontSize: "14px",
        fontWeight: 500,
        lineHeight: 1.71,
        minWidth: "auto",
        paddingLeft: 0,
        paddingRight: 0,
        textTransform: "none",
        "& + &": {marginLeft: "24px"},
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: "var(--TableCell-borderWidth, 1px) solid var(--mui-palette-TableCell-border)",
      },
      paddingCheckbox: {padding: "0 0 0 24px"},
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: {
        [`& .${tableCellClasses.root}`]: {
          backgroundColor: "var(--mui-palette-background-level1)",
          color: "var(--mui-palette-text-secondary)",
          lineHeight: 1,
        },
      },
    },
  },
  MuiTableBody: {
    styleOverrides: {
      root: {
        [`& .${tableRowClasses.root}:last-child`]: {
          [`& .${tableCellClasses.root}`]: {"--TableCell-borderWidth": 0},
        },
      },
    },
  },
  MuiTypography: {
    styleOverrides: {
      h1: {letterSpacing: "-0.02em"},
      h2: {letterSpacing: "-0.02em"},
      h3: {letterSpacing: "-0.015em"},
      h4: {letterSpacing: "-0.015em"},
      h5: {letterSpacing: "-0.01em"},
    },
  },
};
