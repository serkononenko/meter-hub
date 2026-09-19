import type {SvgIconComponent} from "@mui/icons-material";
import BarChartIcon from "@mui/icons-material/BarChart";
import ListAltIcon from "@mui/icons-material/ListAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import SpeedIcon from "@mui/icons-material/Speed";

export const navIcons: Record<string, SvgIconComponent> = {
  "chart-pie": BarChartIcon,
  "list-alt": ListAltIcon,
  settings: SettingsIcon,
  speed: SpeedIcon,
};
