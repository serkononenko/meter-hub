import type {NavItemConfig} from "@/types/nav";
import {paths} from "@/paths";

export const navItems = [
  {key: "overview", title: "Overview", href: paths.dashboard.overview, icon: "chart-pie"},
  {key: "meters", title: "Meters", href: paths.dashboard.meters, icon: "speed"},
  {key: "readings", title: "Readings", href: paths.dashboard.readings, icon: "list-alt"},
  {key: "settings", title: "Settings", href: paths.dashboard.settings, icon: "settings"},
] satisfies NavItemConfig[];
