import { Bike, Car, Gem, Globe, Guitar, Home, Laptop, Package, PiggyBank, Refrigerator, Smartphone, Sofa, Tv, Wind, type LucideProps } from 'lucide-react';

const MAP: Record<string, React.ComponentType<LucideProps>> = {
  car: Car, home: Home, laptop: Laptop, fridge: Refrigerator, sofa: Sofa, gem: Gem, piggy: PiggyBank, globe: Globe, package: Package,
  bike: Bike, phone: Smartphone, tv: Tv, ac: Wind, guitar: Guitar,
};
const SUB_ICON: Record<string, string> = { s_2w: 'bike', s_cycle: 'bike', s_mobile: 'phone', s_tv: 'tv', s_ac: 'ac', s_music: 'guitar' };
export const ICON_NAMES = Object.keys(MAP);

export function CatIcon({ name, size = 20 }: { name?: string; size?: number }) {
  const C = (name && MAP[name]) || Package;
  return <C size={size} />;
}
export function AssetIcon({ categoryIcon, subcategoryId, size = 20 }: { categoryIcon?: string; subcategoryId?: string; size?: number }) {
  return <CatIcon name={(subcategoryId && SUB_ICON[subcategoryId]) || categoryIcon} size={size} />;
}
