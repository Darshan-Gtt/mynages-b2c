import {
  Armchair, Baby, Banknote, Bed, Bike, BookOpen, Box, Briefcase, Building2, Bus, Camera, Car, Coins, Drill, Dumbbell, FileText, Flower2, Gamepad2, Gem, Gift, Globe, Guitar,
  Hammer, Headphones, HeartPulse, Home, Key, Lamp, Landmark, Laptop, Microwave, Monitor, Music, Package, Palette, PawPrint, PiggyBank, Pill, Plane, Printer, Refrigerator,
  Sailboat, Shield, Shirt, ShoppingBag, Smartphone, Sofa, Speaker, Sprout, Tablet, Tent, Tractor, Trophy, Truck, Tv, Wallet, Warehouse, WashingMachine, Watch, Wind, Wrench,
  type LucideProps,
} from 'lucide-react';

/** Standard asset icon library: key → icon + a plain label (used by the category icon chooser). */
export const ICON_LIB: { key: string; label: string; icon: React.ComponentType<LucideProps> }[] = [
  { key: 'car', label: 'Car', icon: Car }, { key: 'bike', label: 'Bike', icon: Bike }, { key: 'bus', label: 'Bus / van', icon: Bus }, { key: 'truck', label: 'Truck', icon: Truck },
  { key: 'tractor', label: 'Tractor', icon: Tractor }, { key: 'boat', label: 'Boat', icon: Sailboat }, { key: 'plane', label: 'Travel', icon: Plane },
  { key: 'home', label: 'Home', icon: Home }, { key: 'building', label: 'Building / flat', icon: Building2 }, { key: 'warehouse', label: 'Shop / godown', icon: Warehouse }, { key: 'sprout', label: 'Land / farm', icon: Sprout },
  { key: 'laptop', label: 'Laptop', icon: Laptop }, { key: 'phone', label: 'Mobile', icon: Smartphone }, { key: 'tablet', label: 'Tablet', icon: Tablet }, { key: 'monitor', label: 'Computer', icon: Monitor },
  { key: 'tv', label: 'TV', icon: Tv }, { key: 'camera', label: 'Camera', icon: Camera }, { key: 'headphones', label: 'Headphones', icon: Headphones }, { key: 'speaker', label: 'Speaker', icon: Speaker },
  { key: 'printer', label: 'Printer', icon: Printer }, { key: 'gamepad', label: 'Gaming', icon: Gamepad2 }, { key: 'watch', label: 'Watch', icon: Watch },
  { key: 'fridge', label: 'Fridge', icon: Refrigerator }, { key: 'washer', label: 'Washing machine', icon: WashingMachine }, { key: 'microwave', label: 'Kitchen appliance', icon: Microwave }, { key: 'ac', label: 'AC / fan', icon: Wind },
  { key: 'sofa', label: 'Sofa', icon: Sofa }, { key: 'bed', label: 'Bed', icon: Bed }, { key: 'chair', label: 'Chair', icon: Armchair }, { key: 'lamp', label: 'Lamp / decor', icon: Lamp },
  { key: 'gem', label: 'Jewellery', icon: Gem }, { key: 'coins', label: 'Gold / coins', icon: Coins }, { key: 'piggy', label: 'Savings', icon: PiggyBank }, { key: 'bank', label: 'Bank', icon: Landmark },
  { key: 'wallet', label: 'Wallet', icon: Wallet }, { key: 'cash', label: 'Cash', icon: Banknote }, { key: 'shield', label: 'Insurance', icon: Shield }, { key: 'doc', label: 'Papers', icon: FileText },
  { key: 'globe', label: 'Online', icon: Globe }, { key: 'guitar', label: 'Guitar', icon: Guitar }, { key: 'music', label: 'Music', icon: Music }, { key: 'palette', label: 'Art', icon: Palette },
  { key: 'book', label: 'Books', icon: BookOpen }, { key: 'trophy', label: 'Trophies', icon: Trophy }, { key: 'dumbbell', label: 'Fitness', icon: Dumbbell }, { key: 'tent', label: 'Outdoor', icon: Tent },
  { key: 'tools', label: 'Tools', icon: Wrench }, { key: 'hammer', label: 'Hardware', icon: Hammer }, { key: 'drill', label: 'Power tools', icon: Drill }, { key: 'key', label: 'Keys / locker', icon: Key },
  { key: 'shirt', label: 'Clothes', icon: Shirt }, { key: 'bag', label: 'Bags', icon: ShoppingBag }, { key: 'gift', label: 'Gifts', icon: Gift }, { key: 'baby', label: 'Kids', icon: Baby },
  { key: 'paw', label: 'Pets', icon: PawPrint }, { key: 'flower', label: 'Garden', icon: Flower2 }, { key: 'health', label: 'Health device', icon: HeartPulse }, { key: 'pill', label: 'Medicine', icon: Pill },
  { key: 'briefcase', label: 'Work', icon: Briefcase }, { key: 'box', label: 'Box', icon: Box }, { key: 'package', label: 'General', icon: Package },
];
const MAP: Record<string, React.ComponentType<LucideProps>> = Object.fromEntries(ICON_LIB.map((i) => [i.key, i.icon]));
const SUB_ICON: Record<string, string> = { s_2w: 'bike', s_cycle: 'bike', s_mobile: 'phone', s_tv: 'tv', s_ac: 'ac', s_music: 'guitar' };
export const ICON_NAMES = Object.keys(MAP);

export function CatIcon({ name, size = 20 }: { name?: string; size?: number }) {
  const C = (name && MAP[name]) || Package;
  return <C size={size} />;
}
export function AssetIcon({ categoryIcon, subcategoryId, size = 20 }: { categoryIcon?: string; subcategoryId?: string; size?: number }) {
  return <CatIcon name={(subcategoryId && SUB_ICON[subcategoryId]) || categoryIcon} size={size} />;
}
