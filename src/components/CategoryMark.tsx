import { ShoppingBasket, Utensils, CarTaxiFront, Pill, Car, BusFront, TrainFront, Truck, Clapperboard, ShoppingBag, Fuel, Gem, Smartphone, House, Flower2, Shapes } from 'lucide-react';
import { categoryKind } from '../lib/presentation';

const icons = { supermarket: ShoppingBasket, restaurant: Utensils, taxi: CarTaxiFront, pharmacy: Pill, carshare: Car, transport: BusFront, train: TrainFront, delivery: Truck, entertainment: Clapperboard, shopping: ShoppingBag, fuel: Fuel, jewelry: Gem, electronics: Smartphone, home: House, flowers: Flower2, other: Shapes };
export function CategoryMark({ name }: { name: string }) {
  const Icon = icons[categoryKind(name) as keyof typeof icons] ?? Shapes;
  return <span className="category-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.8}/></span>;
}
