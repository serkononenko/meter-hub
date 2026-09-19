import type {Components, Theme} from "@mui/material/styles";
import {paperClasses} from "@mui/material/Paper";
import {tableCellClasses} from "@mui/material/TableCell";
import {tableRowClasses} from "@mui/material/TableRow";

/**
 * Component style overrides ported from the Devias Kit (rounded buttons,
 * soft cards, level-shaded table headers, gap-based stacks).
 */
export const components: Components<Theme> = {
  MuiAvatar: {
    styleOverrides: {
      root: {fontSize: "14px", fontWeight: 600, letterSpacing: 0},
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {borderRadius: "12px", textTransform: "none"},
      sizeSmall: {padding: "6px 16px"},
      sizeMedium: {padding: "8px 20px"},
      sizeLarge: {padding: "11px 24px"},
    },
  },
  MuiCard: {
    styleOverrides: {
      root: ({theme}) => ({
        borderRadius: "20px",
        [`&.${paperClasses.elevation1}`]: {
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 5px 22px 0 rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.12)"
              : "0 5px 22px 0 rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.06)",
        },
      }),
    },
  },
  MuiCardContent: {
    styleOverrides: {
      root: {padding: "32px 24px", "&:last-child": {paddingBottom: "32px"}},
    },
  },
  MuiCardHeader: {
    styleOverrides: {root: {padding: "32px 24px 16px"}},
  },
  MuiLink: {defaultProps: {underline: "hover"}},
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
  MuiTableBody: {
    styleOverrides: {
      root: {
        [`& .${tableRowClasses.root}:last-child`]: {
          [`& .${tableCellClasses.root}`]: {"--TableCell-borderWidth": 0},
        },
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
};
