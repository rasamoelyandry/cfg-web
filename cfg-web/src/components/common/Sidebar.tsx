import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', roles: ['SUPER_ADMIN','OWNER','MANAGER'] },
  { to: '/admin/orders',    label: 'Commandes',  roles: ['SUPER_ADMIN','OWNER','MANAGER','WAITER'] },
  { to: '/kitchen',         label: 'Cuisine',    roles: ['KITCHEN','MANAGER','OWNER','SUPER_ADMIN'] },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const filtered = navItems.filter(n => !user || n.roles.includes(user.role))

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>CFG</div>
      <nav className={styles.nav}>
        {filtered.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.footer}>
        {user && (
          <>
            <span className={styles.username}>{user.firstName}</span>
            <button className={styles.logout} onClick={logout}>
              Déconnexion
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
