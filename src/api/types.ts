export type Role = 'owner' | 'staff';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  stock_qty: number;
  reorder_level: number;
  is_active: boolean;
  is_low: boolean;
  /** Owner only */
  cost_per_unit?: number;
}

export interface RecipeLine {
  ingredient_id: number;
  name: string;
  unit: string;
  quantity: number;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  is_active: boolean;
  /** null when the product has no recipe, so stock is not tracked */
  servings_available: number | null;
  /** Owner only */
  unit_cost?: number;
  recipe?: RecipeLine[];
}

export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'other';

export interface OrderItem {
  product_id: number | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: number;
  order_number: string;
  status: 'completed' | 'voided';
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  amount_tendered: number | null;
  change_due: number;
  customer_note: string | null;
  created_at: string;
  voided_at: string | null;
  cashier?: string;
  items?: OrderItem[];
  /** Owner only */
  total_cost?: number;
  profit?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

export interface Expense {
  id: number;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  recorded_by: string | null;
}

export interface ExpensesResponse {
  data: Expense[];
  total: number;
  from: string;
  to: string;
  categories: string[];
}

export interface StockMovement {
  id: number;
  type: 'purchase' | 'usage' | 'adjustment' | 'waste' | 'void_return' | 'opening';
  quantity: number;
  total_cost: number | null;
  note: string | null;
  user: string | null;
  created_at: string;
}

export type DashboardRange = 'today' | 'week' | 'month';

export interface DashboardData {
  range: DashboardRange;
  from: string;
  to: string;
  sales: number;
  orders: number;
  items_sold: number;
  average_order: number;
  cost_of_goods: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  ingredient_purchases: number;
  sales_by_day: { date: string; label: string; sales: number; orders: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
  payment_breakdown: { method: PaymentMethod; total: number; orders: number }[];
  low_stock: { id: number; name: string; unit: string; stock_qty: number; reorder_level: number }[];
}
