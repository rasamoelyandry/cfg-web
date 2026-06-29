import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { ordersApi } from '../../api/orders'
import type { Order, PageResponse } from '../../types'
import styles from './OrdersPage.module.css'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', PENDING: 'En attente', PREPARING: 'En préparation',
  READY: 'Prêt', SERVED: 'Servi', PAID: 'Payé', CANCELLED: 'Annulé',
}

export default function OrdersPage() {
  const { user } = useAuthStore()
  const [page, setPage] = useState<PageResponse<Order> | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = (p: number) => {
    if (!user?.restaurantId) return
    setLoading(true)
    ordersApi.getAll(user.restaurantId, p)
      .then(setPage)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(currentPage) }, [currentPage, user?.restaurantId])

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Commandes</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th><th>Table</th><th>Client</th>
                <th>Articles</th><th>Total</th><th>Statut</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {page?.content.map(order => (
                <tr key={order.id}>
                  <td className={styles.id}>{order.id.slice(-8)}</td>
                  <td>{order.tableId ? order.tableId.slice(-4) : '—'}</td>
                  <td>{order.customerName || '—'}</td>
                  <td>{order.items.length}</td>
                  <td>{order.totalAmount.toLocaleString()} MGA</td>
                  <td>
                    <span className={`${styles.badge} status-${order.status}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </td>
                  <td>{new Date(order.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {page && page.totalPages > 1 && (
            <div className={styles.pagination}>
              <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>
                Précédent
              </button>
              <span>{currentPage + 1} / {page.totalPages}</span>
              <button onClick={() => setCurrentPage(p => p + 1)} disabled={page.last}>
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
