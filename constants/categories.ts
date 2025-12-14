import { ExpenseCategory } from "../types/expense";
import {
  Utensils,
  Car,
  Home,
  Film,
  Activity,
  Circle,
} from "@tamagui/lucide-icons";
import { ComponentProps, JSX } from "react";

type IconComponent = (propsIn: ComponentProps<typeof Utensils>) => JSX.Element;

export const CATEGORIES: {
  label: string;
  value: ExpenseCategory;
  icon: IconComponent;
  color: string;
}[] = [
  { label: "Food", value: "Food", icon: Utensils, color: "#f97316" }, // orange
  { label: "Transport", value: "Transport", icon: Car, color: "#3b82f6" }, // blue
  { label: "Utilities", value: "Utilities", icon: Home, color: "#eab308" }, // yellow
  {
    label: "Entertainment",
    value: "Entertainment",
    icon: Film,
    color: "#a855f7",
  }, // purple
  { label: "Health", value: "Health", icon: Activity, color: "#ef4444" }, // red
  { label: "Other", value: "Other", icon: Circle, color: "#6b7280" }, // gray
];
