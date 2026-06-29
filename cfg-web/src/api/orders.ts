import { apiClient } from './client'
import type { ApiResponse, Order, PageResponse, Payment } from '../types'

export const ordersApi = {
  getAll: (restaurantId: string, page = 0, size = 20) =>
    apiClient.get<ApiResponse<PageResponse<Order>>>(
      `/restaurants/${restaurantId}/orders?page=${page}&size=${size}`
    ).then(r => r.data.data),

  getActive: (restaurantId: string) =>
    apiClient.get<ApiResponse<Order[]>>(
      `/restaurants/${restaurantId}/orders/active`
    ).then(r => r.data.data),

  getOne: (restaurantId: string, orderId: string) =>
    apiClient.get<ApiResponse<Order>>(
      `/restaurants/${restaurantId}/orders/${orderId}`
    ).then(r => r.data.data),

  create: (restaurantId: string, payload: unknown) =>
    apiClient.post<ApiResponse<Order>>(
      `/restaurants/${restaurantId}/orders`, payload
    ).then(r => r.data.data),

  updateStatus: (restaurantId: string, orderId: string, status: string) =>
    apiClient.patch<ApiResponse<Order>>(
      `/restaurants/${restaurantId}/orders/${orderId}/status`, { status }
    ).then(r => r.data.data),

  transfer: (restaurantId: string, orderId: string, targetTableId: string) =>
    apiClient.post<ApiResponse<Order>>(
      `/restaurants/${restaurantId}/orders/${orderId}/transfer`, { targetTableId }
    ).then(r => r.data.data),

  pay: (restaurantId: string, orderId: string, payload: unknown) =>
    apiClient.post<ApiResponse<Payment>>(
      `/restaurants/${restaurantId}/orders/${orderId}/payment`, payload
    ).then(r => r.data.data),
}
