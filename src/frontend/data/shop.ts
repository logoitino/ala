export type ShopItem = {
  id: string;
  name: string;
  category: 'gear' | 'apparel' | 'badge';
  priceLabel: string;
  blurb: string;
};

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'gear-1',
    name: 'Sideline Hydration Bottle',
    category: 'gear',
    priceLabel: '$18',
    blurb: 'Team-marked bottle for Friday nights.',
  },
  {
    id: 'gear-2',
    name: 'Wrist Coach Playband',
    category: 'gear',
    priceLabel: '$24',
    blurb: 'Call the next play from the stands.',
  },
  {
    id: 'app-1',
    name: 'Hawks Booster Hoodie',
    category: 'apparel',
    priceLabel: '$54',
    blurb: 'Heavyweight fleece with booster crest.',
  },
  {
    id: 'app-2',
    name: 'Rivalry Night Tee',
    category: 'apparel',
    priceLabel: '$32',
    blurb: 'Westlake vs Lone Peak throwback print.',
  },
  {
    id: 'badge-1',
    name: 'Friday Lights Badge',
    category: 'badge',
    priceLabel: '120 pts',
    blurb: 'Digital badge for backing a live TD.',
  },
  {
    id: 'badge-2',
    name: 'Iron Fan Badge',
    category: 'badge',
    priceLabel: '250 pts',
    blurb: 'Unlocks after 10 tips this season.',
  },
];

export const SHOP_CATEGORY_LABELS: Record<ShopItem['category'], string> = {
  gear: 'Team gear',
  apparel: 'Booster apparel',
  badge: 'Digital fan badges',
};
