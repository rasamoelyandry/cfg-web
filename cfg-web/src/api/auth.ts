import { apiClient } from './client'
import type { ApiResponse, User } from '../types'

export interface LoginPayload {
  email?: string
  phone?: string
  password: string
}

export interface LoginData {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: User
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<ApiResponse<LoginData>>('/auth/login', payload).then(r => r.data.data),

  me: () =>
    apiClient.get<ApiResponse<User>>('/auth/me').then(r => r.data.data),

  logout: () =>
    apiClient.post('/auth/logout'),
}
