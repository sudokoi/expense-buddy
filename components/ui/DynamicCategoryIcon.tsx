import { memo } from "react"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"
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
} from "lucide-react-native"

// Static map of icon name to component - uses typeof to get the correct lucide-react-native icon type
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
  size = UI_ICON_SIZE.large,
  color,
}: DynamicCategoryIconProps) {
  const theme = useThemeColors()
  const IconComponent = ICON_MAP[name as keyof typeof ICON_MAP] || Circle
  return <IconComponent size={size} color={color ?? theme.foreground} />
})

export type { DynamicCategoryIconProps }
