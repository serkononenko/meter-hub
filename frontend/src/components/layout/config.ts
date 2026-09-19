import type {NavItemConfig} from "@/types/nav";
import {paths} from "@/paths";

export const navItems = [
  {key: "households", title: "Households", href: paths.households, icon: "home"},
  {key: "meters", title: "Meters", href: paths.meters, icon: "speed"},
  {key: "readings", title: "Readings", href: paths.readings, icon: "list-alt"},
  {key: "settings", title: "Settings", href: paths.settings, icon: "settings"},
] satisfies NavItemConfig[];
