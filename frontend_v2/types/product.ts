export interface Category {
  id: number;
  shopId: number;
  name: string;
  slug?: string;
  displayOrder: number;
  productCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryRequest {
  name: string;
  displayOrder?: number;
}

export interface ProductImage {
  id?: number;
  imageUrl: string;
  displayOrder: number;
  altText?: string;
}

export interface ProductHighlight {
  id?: number;
  highlightText: string;
  displayOrder: number;
}

export interface ProductVariant {
  id?: number;
  name: string;
  price: number;
  originalPrice?: number | null;
  imageUrl?: string | null;
  description?: string | null;
  displayOrder?: number;
  variantType?: string;
  isAvailable?: boolean;
}

export interface ProductAddon {
  id?: number;
  name: string;
  price: number;
  isAvailable?: boolean;
}

export interface Product {
  id: number;
  shopId: number;
  name: string;
  description: string;
  price: number;
  originalPrice?: number | null;
  categoryId?: number | null;
  categoryName?: string | null;
  category?: string;
  imageUrl?: string;
  isEggless: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  allowEggChoice?: boolean;
  eggPreferenceDefault?: 'EGGLESS' | 'REGULAR' | string;
  egglessPriceDiff?: number;
  inStock: boolean;
  availability?: boolean;
  status?: string;
  preparationTimeHours?: number;
  weightGrams?: number;
  ingredients?: string | null;
  allergens?: string | null;
  images?: ProductImage[];
  highlights?: ProductHighlight[];
  variants?: ProductVariant[];
  addons?: ProductAddon[];
  rating?: number;
  averageRating?: number;
  reviewCount?: number;
  totalReviews?: number;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  ingredients?: string | null;
  allergens?: string | null;
  price: number;
  originalPrice?: number | null;
  categoryId?: number | null;
  category?: string;
  imageUrl?: string;
  isEggless?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  allowEggChoice?: boolean;
  eggPreferenceDefault?: string;
  egglessPriceDiff?: number;
  inStock?: boolean;
  availability?: boolean;
  preparationTimeHours?: number;
  weightGrams?: number;
  images?: ProductImage[];
  highlights?: ProductHighlight[];
  variants?: ProductVariant[];
  addons?: ProductAddon[];
}
