import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useKitchenStore } from '../../store/kitchenStore'
import { useKitchenWebSocket } from '../../hooks/useWebSocket'
import { ordersApi } from '../../api/orders'
import type { Order, OrderStatus } from '../../types'
import styles from './KitchenBoardPage.module.css'

const COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING',   label: 'En attente' },
  { status: 'PREPARING', label: 'En préparation' },
  { status: 'READY',     label: 'Prêt à servir' },
]

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING:   'PREPARING',
  PREPARING: 'READY',
  READY:     'SERVED',
}

export default function KitchenBoardPage() {
  const { user } = useAuthStore()
  const { orders, setOrders, upsertOrder, connected } = useKitchenStore()

  useKitchenWebSocket(user?.restaurantId ?? null)

  useEffect(() => {
    if (!user?.restaurantId) return
    ordersApi.getActive(user.restaurantId).then(setOrders)
  }, [user?.restaurantId])

  const handleAdvance = async (order: Order) => {
    if (!user?.restaurantId) return
    const next = NEXT_STATUS[order.status]
    if (!next) return
    try {
      const updated = await ordersApi.updateStatus(user.restaurantId, order.id, next)
      upsertOrder(updated)
    } catch { /* ignore */ }
  }

  const colOrders = (status: OrderStatus) =>
    orders.filter(o => o.status === status)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Cuisine</h1>
        <span className={`${styles.wsStatus} ${connected ? styles.connected : styles.disconnected}`}>
          {connected ? '● En ligne' : '○ Hors ligne'}
        </span>
      </div>

      <div className={styles.board}>
        {COLUMNS.map(col => (
          <div key={col.status} className={`${styles.column} status-${col.status}`}>
            <div className={styles.colHeader}>
              <span>{col.label}</span>
              <span className={styles.colCount}>{colOrders(col.status).length}</span>
            </div>
            <div className={styles.cards}>
              {colOrders(col.status).map(order => (
                <KitchenCard key={order.id} order={order} onAdvance={handleAdvance} />
              ))}
              {colOrders(col.status).length === 0 && (
                <p className={styles.empty}>Aucune commande</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KitchenCard({ order, onAdvance }: { order: Order; onAdvance: (o: Order) => void }) {
  const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
  const isUrgent = elapsed > 15

  return (
    <div className={`${styles.card} ${isUrgent ? styles.urgent : ''}`}>
      <div className={styles.cardHeader}>
        <strong>Table {order.tableId?.slice(-4) || 'N/A'}</strong>
        <span className={`${styles.elapsed} ${isUrgent ? styles.urgentTime : ''}`}>
          {elapsed}min
        </span>
      </div>
      {order.customerName && (
        <p className={styles.customer}>{order.customerName}</p>
      )}
      <ul className={styles.items}>
        {order.items.filter(i => i.status !== 'CANCELLED').map(item => (
          <li key={item.id}>
            <span className={styles.qty}>{item.quantity}×</span>
            <span>{item.menuItemName}</span>
            {item.notes && <span className={styles.note}> — {item.notes}</span>}
          </li>
        ))}
      </ul>
      {NEXT_STATUS[order.status as OrderStatus] && (
        <button className={styles.advanceBtn} onClick={() => onAdvance(order)}>
          {order.status === 'PENDING' ? 'Commencer' :
           order.status === 'PREPARING' ? 'Marquer prêt' : 'Servir'}
        </button>
      )}
    </div>
  )
}
