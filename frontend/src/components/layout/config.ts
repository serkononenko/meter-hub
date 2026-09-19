import type {NavItemConfig} from "@/types/nav";
import {paths} from "@/paths";

export const navItems = [
  {key: "households", title: "Households", href: paths.households, icon: "home"},
  {key: "settings", title: "Settings", href: paths.settings, icon: "settings"},
] satisfies NavItemConfig[];
