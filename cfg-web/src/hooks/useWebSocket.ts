import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useKitchenStore } from '../store/kitchenStore'
import type { Order } from '../types'

const WS_URL = import.meta.env.VITE_WS_URL || '/ws'

export function useKitchenWebSocket(restaurantId: string | null) {
  const clientRef = useRef<Client | null>(null)
  const { upsertOrder, setConnected } = useKitchenStore()

  useEffect(() => {
    if (!restaurantId) return

    const token = localStorage.getItem('accessToken')
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL) as WebSocket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe(`/topic/kitchen/${restaurantId}`, (msg) => {
          try {
            const event = JSON.parse(msg.body)
            if (event.orderId && event.status) {
              upsertOrder(event as unknown as Order)
            }
          } catch { /* ignore malformed */ }
        })
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    })

    client.activate()
    clientRef.current = client

    return () => { client.deactivate() }
  }, [restaurantId])
}
