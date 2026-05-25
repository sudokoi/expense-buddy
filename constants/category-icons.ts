import type React from "react"
import type { IconProps } from "@tamagui/helpers-icon"
import {
  Utensils,
  Coffee,
  Pizza,
  Wine,
  Beer,
  Cake,
  Apple,
  Sandwich,
  Car,
  Bus,
  Train,
  Plane,
  Bike,
  Ship,
  Fuel,
  ParkingCircle,
  ShoppingCart,
  ShoppingBag,
  Gift,
  Tag,
  Shirt,
  Watch,
  Gem,
  Package,
  Home,
  Building,
  Sofa,
  Lamp,
  Wrench,
  Hammer,
  Paintbrush,
  Key,
  Activity,
  Heart,
  Pill,
  Stethoscope,
  Dumbbell,
  Leaf,
  Sun,
  Smile,
  Film,
  Music,
  Gamepad,
  Tv,
  Book,
  Camera,
  Ticket,
  Palette,
  Wallet,
  CreditCard,
  Banknote,
  PiggyBank,
  Briefcase,
  Calculator,
  Receipt,
  TrendingUp,
  Circle,
  Star,
  Bookmark,
  Flag,
  Bell,
  Calendar,
  Clock,
  MapPin,
} from "@tamagui/lucide-icons-2"

/**
 * Curated icon list for expense categories
 * Icons are organized into logical groups for easy selection
 */

/**
 * Static icon component map for tree-shaking.
 * Each icon is individually imported so bundlers can tree-shake unused icons.
 */
export const CATEGORY_ICON_MAP: Record<string, (props: IconProps) => React.JSX.Element> =
  {
    Utensils,
    Coffee,
    Pizza,
    Wine,
    Beer,
    Cake,
    Apple,
    Sandwich,
    Car,
    Bus,
    Train,
    Plane,
    Bike,
    Ship,
    Fuel,
    ParkingCircle,
    ShoppingCart,
    ShoppingBag,
    Gift,
    Tag,
    Shirt,
    Watch,
    Gem,
    Package,
    Home,
    Building,
    Sofa,
    Lamp,
    Wrench,
    Hammer,
    Paintbrush,
    Key,
    Activity,
    Heart,
    Pill,
    Stethoscope,
    Dumbbell,
    Leaf,
    Sun,
    Smile,
    Film,
    Music,
    Gamepad,
    Tv,
    Book,
    Camera,
    Ticket,
    Palette,
    Wallet,
    CreditCard,
    Banknote,
    PiggyBank,
    Briefcase,
    Calculator,
    Receipt,
    TrendingUp,
    Circle,
    Star,
    Bookmark,
    Flag,
    Bell,
    Calendar,
    Clock,
    MapPin,
  }

/**
 * Represents a group of related icons
 */
export interface IconGroup {
  /** Display name for the group */
  name: string
  /** Array of Lucide icon names */
  icons: string[]
}

/**
 * Curated expense-relevant icons organized by category
 * Each group contains 6-8 icons for a total of ~50 icons
 */
export const CATEGORY_ICON_GROUPS: IconGroup[] = [
  {
    name: "Food & Drink",
    icons: ["Utensils", "Coffee", "Pizza", "Wine", "Beer", "Cake", "Apple", "Sandwich"],
  },
  {
    name: "Transportation",
    icons: ["Car", "Bus", "Train", "Plane", "Bike", "Ship", "Fuel", "ParkingCircle"],
  },
  {
    name: "Shopping",
    icons: [
      "ShoppingCart",
      "ShoppingBag",
      "Gift",
      "Tag",
      "Shirt",
      "Watch",
      "Gem",
      "Package",
    ],
  },
  {
    name: "Home & Living",
    icons: ["Home", "Building", "Sofa", "Lamp", "Wrench", "Hammer", "Paintbrush", "Key"],
  },
  {
    name: "Health & Wellness",
    icons: [
      "Activity",
      "Heart",
      "Pill",
      "Stethoscope",
      "Dumbbell",
      "Leaf",
      "Sun",
      "Smile",
    ],
  },
  {
    name: "Entertainment",
    icons: ["Film", "Music", "Gamepad", "Tv", "Book", "Camera", "Ticket", "Palette"],
  },
  {
    name: "Finance & Work",
    icons: [
      "Wallet",
      "CreditCard",
      "Banknote",
      "PiggyBank",
      "Briefcase",
      "Calculator",
      "Receipt",
      "TrendingUp",
    ],
  },
  {
    name: "General",
    icons: ["Circle", "Star", "Bookmark", "Flag", "Bell", "Calendar", "Clock", "MapPin"],
  },
]

/**
 * Flattened array of all available category icons
 */
export const ALL_CATEGORY_ICONS: string[] = CATEGORY_ICON_GROUPS.flatMap(
  (group) => group.icons
)
