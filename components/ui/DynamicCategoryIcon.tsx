import { memo } from "react"
import {
  // Food & Drink
  Utensils,
  Coffee,
  Pizza,
  Wine,
  Beer,
  Cake,
  Apple,
  Sandwich,
  // Transportation
  Car,
  Bus,
  Train,
  Plane,
  Bike,
  Ship,
  Fuel,
  ParkingCircle,
  // Shopping
  ShoppingCart,
  ShoppingBag,
  Gift,
  Tag,
  Shirt,
  Watch,
  Gem,
  Package,
  // Home & Living
  Home,
  Building,
  Sofa,
  Lamp,
  Wrench,
  Hammer,
  Paintbrush,
  Key,
  // Health & Wellness
  Activity,
  Heart,
  Pill,
  Stethoscope,
  Dumbbell,
  Leaf,
  Sun,
  Smile,
  // Entertainment
  Film,
  Music,
  Gamepad,
  Tv,
  Book,
  Camera,
  Ticket,
  Palette,
  // Finance & Work
  Wallet,
  CreditCard,
  Banknote,
  PiggyBank,
  Briefcase,
  Calculator,
  Receipt,
  TrendingUp,
  // General
  Circle,
  Star,
  Bookmark,
  Flag,
  Bell,
  Calendar,
  Clock,
  MapPin,
} from "@tamagui/lucide-icons"

// Static map of icon name to component - uses typeof to get correct Tamagui icon type
const ICON_MAP = {
  // Food & Drink
  Utensils,
  Coffee,
  Pizza,
  Wine,
  Beer,
  Cake,
  Apple,
  Sandwich,
  // Transportation
  Car,
  Bus,
  Train,
  Plane,
  Bike,
  Ship,
  Fuel,
  ParkingCircle,
  // Shopping
  ShoppingCart,
  ShoppingBag,
  Gift,
  Tag,
  Shirt,
  Watch,
  Gem,
  Package,
  // Home & Living
  Home,
  Building,
  Sofa,
  Lamp,
  Wrench,
  Hammer,
  Paintbrush,
  Key,
  // Health & Wellness
  Activity,
  Heart,
  Pill,
  Stethoscope,
  Dumbbell,
  Leaf,
  Sun,
  Smile,
  // Entertainment
  Film,
  Music,
  Gamepad,
  Tv,
  Book,
  Camera,
  Ticket,
  Palette,
  // Finance & Work
  Wallet,
  CreditCard,
  Banknote,
  PiggyBank,
  Briefcase,
  Calculator,
  Receipt,
  TrendingUp,
  // General
  Circle,
  Star,
  Bookmark,
  Flag,
  Bell,
  Calendar,
  Clock,
  MapPin,
} as const

interface DynamicCategoryIconProps {
  /** Icon name from the curated list */
  name: string
  /** Icon size in pixels */
  size?: number
  /** Icon color - hex string like "#RRGGBB" */
  color?: `#${string}`
}

/**
 * DynamicCategoryIcon - Renders a category icon by name
 * Uses a static map of curated icons to avoid dynamic imports
 * Falls back to Circle if icon name is not found
 */
export const DynamicCategoryIcon = memo(function DynamicCategoryIcon({
  name,
  size = 24,
  color,
}: DynamicCategoryIconProps) {
  const IconComponent = ICON_MAP[name as keyof typeof ICON_MAP] || Circle
  // Render with or without color to satisfy Tamagui's strict type system
  if (color) {
    return <IconComponent size={size} color={color} />
  }
  return <IconComponent size={size} />
})

export type { DynamicCategoryIconProps }
