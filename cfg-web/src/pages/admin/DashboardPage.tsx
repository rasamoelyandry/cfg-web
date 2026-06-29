import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { ordersApi } from '../../api/orders'
import type { Order } from '../../types'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.restaurantId) return
    ordersApi.getActive(user.restaurantId)
      .then(setActiveOrders)
      .finally(() => setLoading(false))
  }, [user?.restaurantId])

  const byStatus = (status: string) => activeOrders.filter(o => o.status === status)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard</h1>

      <div className={styles.stats}>
        <StatCard label="En attente"     count={byStatus('PENDING').length}   color="#e37400" />
        <StatCard label="En préparation" count={byStatus('PREPARING').length} color="#1a73e8" />
        <StatCard label="Prêts"          count={byStatus('READY').length}     color="#188038" />
        <StatCard label="Servis"         count={byStatus('SERVED').length}    color="#5f6368" />
      </div>

      <div className={styles.section}>
        <h2>Commandes actives</h2>
        {loading ? (
          <p>Chargement...</p>
        ) : activeOrders.length === 0 ? (
          <p className={styles.empty}>Aucune commande active</p>
        ) : (
          <div className={styles.orderList}>
            {activeOrders.map(order => (
              <div key={order.id} className={`${styles.orderRow} status-${order.status}`}>
                <span className={styles.table}>
                  {order.tableId ? `Table ${order.tableId.slice(-4)}` : 'À emporter'}
                </span>
                <span className={styles.customer}>{order.customerName || '—'}</span>
                <span className={styles.items}>{order.items.length} article(s)</span>
                <span className={styles.total}>{order.totalAmount.toLocaleString()} MGA</span>
                <span className={`${styles.badge} status-${order.status}`}>{order.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={styles.statCard} style={{ borderTop: `4px solid ${color}` }}>
      <p className={styles.statCount} style={{ color }}>{count}</p>
      <p className={styles.statLabel}>{label}</p>
    </div>
  )
}
