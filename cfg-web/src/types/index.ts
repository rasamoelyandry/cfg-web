export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'WAITER' | 'KITCHEN'

export interface User {
  id: string
  restaurantId: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  role: Role
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  currency: string
  isActive: boolean
}

export interface RestaurantTable {
  id: string
  restaurantId: string
  number: number
  label: string | null
  capacity: number
  isActive: boolean
}

export interface MenuCategory {
  id: string
  restaurantId: string
  name: string
  sortOrder: number
  isActive: boolean
  items?: MenuItem[]
}

export interface MenuItem {
  id: string
  categoryId: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  isAvailable: boolean
  modifiers: MenuItemModifier[]
}

export interface MenuItemModifier {
  id: string
  name: string
  priceDelta: number
  isDefault: boolean
}

export type OrderStatus =
  | 'DRAFT' | 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID' | 'CANCELLED'

export type PaymentMethod = 'CASH' | 'ORANGE_MONEY' | 'MVOLA' | 'AIRTEL_MONEY'

export interface Order {
  id: string
  restaurantId: string
  tableId: string | null
  waiterId: string | null
  customerName: string | null
  status: OrderStatus
  notes: string | null
  totalAmount: number
  clientUuid: string | null
  sentToKitchenAt: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

export interface OrderItem {
  id: string
  menuItemId: string
  menuItemName: string
  unitPrice: number
  quantity: number
  notes: string | null
  status: string
}

export interface Payment {
  id: string
  orderId: string
  method: PaymentMethod
  amount: number
  reference: string | null
  paidAt: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}
