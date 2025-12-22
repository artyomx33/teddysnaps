// Database types
export interface Location {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  created_at: string;
}

export interface Family {
  id: string;
  location_id: string;
  family_name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  created_at: string;
}

export interface Child {
  id: string;
  family_id: string;
  first_name: string;
  date_of_birth: string | null;
  face_descriptor: number[] | null;
  reference_photo_url: string | null;
  is_enrolled: boolean;
  created_at: string;
}

export interface PhotoSession {
  id: string;
  location_id: string;
  name: string;
  shoot_date: string;
  status: "processing" | "ready" | "archived";
  total_photos: number;
  created_at: string;
}

export interface Photo {
  id: string;
  session_id: string;
  original_url: string;
  thumbnail_url: string | null;
  processed_url: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  faces_detected: number;
  needs_review: boolean;
  created_at: string;
}

export interface PhotoChild {
  id: string;
  photo_id: string;
  child_id: string;
  confidence: number | null;
  is_confirmed: boolean;
  created_at: string;
}

export interface DiscoveredFace {
  id: string;
  session_id: string;
  photo_id: string;
  face_descriptor: number[];
  crop_url: string;
  detection_score: number;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  cluster_id: string | null;
  child_id: string | null;
  confidence: number | null;
  is_named: boolean;
  is_skipped: boolean;
  created_at: string;
}

export interface FaceCluster {
  cluster_id: string;
  faces: DiscoveredFace[];
  child_id: string | null;
  child_name: string | null;
  representative_crop_url: string;
  face_count: number;
}

export interface Product {
  id: string;
  name: string;
  type: "digital" | "print" | "canvas" | "book";
  size: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Order {
  id: string;
  family_id: string;
  session_id: string;
  order_number: string;
  status: "pending" | "paid" | "processing" | "ready" | "delivered";
  delivery_method: "email" | "whatsapp" | "pickup" | "delivery";
  delivery_address: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_id: string | null;
  payment_status: "pending" | "paid" | "failed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  photo_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "photographer" | "teacher";
  location_id: string | null;
  created_at: string;
}

// Extended types with relations
export interface FamilyWithChildren extends Family {
  children: Child[];
}

export interface PhotoWithMatches extends Photo {
  matches: Array<{
    child: Child;
    confidence: number | null;
    is_confirmed: boolean;
  }>;
}

export interface OrderWithDetails extends Order {
  family: Family;
  items: Array<
    OrderItem & {
      photo: Photo;
      product: Product;
    }
  >;
}

// Pricing configuration
export interface PricingConfig {
  products: Product[];
  discounts: {
    bundleThreshold: number;
    bundlePercent: number;
  };
}
