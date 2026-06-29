import { create } from 'zustand'
import type { Order } from '../types'

interface KitchenState {
  orders: Order[]
  connected: boolean
  setOrders: (orders: Order[]) => void
  upsertOrder: (order: Order) => void
  setConnected: (v: boolean) => void
}

export const useKitchenStore = create<KitchenState>((set, get) => ({
  orders: [],
  connected: false,

  setOrders: (orders) => set({ orders }),

  upsertOrder: (incoming) => {
    const existing = get().orders
    const idx = existing.findIndex(o => o.id === incoming.id)
    if (idx >= 0) {
      const updated = [...existing]
      updated[idx] = incoming
      set({ orders: updated })
    } else {
      set({ orders: [incoming, ...existing] })
    }
  },

  setConnected: (connected) => set({ connected }),
}))
