# CFG — Plateforme de Gestion Multi-Restaurants

> MVP production-ready · Spring Boot · React · Android natif · PostgreSQL · Docker

---

## Synthèse Architecture

CFG est une plateforme SaaS multi-tenant de type POS (Point of Sale) pour restaurants et boutiques. L'architecture suit un modèle **monolithe modulaire** côté backend (prêt à découper en microservices), avec des frontends séparés par rôle.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│  [Android Serveur]  [React Cuisine]  [React Admin/Backoffice]   │
└────────┬──────────────────┬──────────────────┬──────────────────┘
         │ REST + WS        │ REST + WS         │ REST
         ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NGINX Reverse Proxy                            │
│         (SSL termination, routing, rate limiting)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              Spring Boot Backend (Port 8080)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │   Auth   │ │  Orders  │ │  Kitchen │ │  Restaurant Mgmt   │ │
│  │  Module  │ │  Module  │ │  Module  │ │      Module        │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │  Menus   │ │ Payments │ │   Sync   │ │   WebSocket Hub    │ │
│  │  Module  │ │  Module  │ │  Module  │ │   (STOMP/WS)       │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │ PostgreSQL │ │   Redis    │ │   Volumes  │
       │  (Port     │ │  (Cache +  │ │  (Logs,    │
       │   5432)    │ │   Sessions)│ │   Uploads) │
       └────────────┘ └────────────┘ └────────────┘
```

**Décisions clés :**
- **Monolithe modulaire** : livraison rapide, refactoring en microservices possible sans réécriture
- **WebSocket STOMP** sur Spring : temps réel cuisine, broadcast par restaurant
- **JWT stateless** : mobile offline-friendly, pas de session serveur
- **Multi-tenant par colonne** : `restaurant_id` sur chaque entité métier, isolement simple et performant pour ce stade
- **Sync offline** : queue locale SQLite Android + endpoint `/sync/batch` avec idempotence par `client_id`
- **Redis** : sessions refresh token, cache menu, pub/sub WebSocket si scaling horizontal

---

## Table des Matières

1. [Vision Produit & MVP](#1-vision-produit--mvp)
2. [Architecture Système](#2-architecture-système)
3. [Structure des Dépôts](#3-structure-des-dépôts)
4. [Schéma Base de Données](#4-schéma-base-de-données)
5. [Endpoints API](#5-endpoints-api)
6. [Architecture Interface](#6-architecture-interface)
7. [Implémentation](#7-implémentation)
8. [Déploiement](#8-déploiement)
9. [Évolution Future](#9-évolution-future)
10. [Lancement Local](#10-lancement-local)

---

## 1. Vision Produit & MVP

### Ce que fait le MVP

| Fonctionnalité | Inclus |
|---|---|
| Authentification email + téléphone | ✅ |
| Gestion multi-restaurants | ✅ |
| Gestion des tables (numéro simple) | ✅ |
| Prise de commande sur tablette Android | ✅ |
| Transfert commande entre tables | ✅ |
| Client associé à une commande | ✅ |
| Articles + quantités + notes spéciales | ✅ |
| Statuts de commande | ✅ |
| Affectation serveur | ✅ |
| Affichage cuisine temps réel (WebSocket) | ✅ |
| Total commande | ✅ |
| Paiement (espèces, Orange Money, MVola, Airtel) | ✅ |
| Mode offline Android + sync automatique | ✅ |
| Backoffice admin/owner | ✅ |
| Gestion des menus + catégories + articles | ✅ |
| Gestion des rôles et utilisateurs | ✅ |
| Logs applicatifs | ✅ |

### Ce que le MVP ne fait PAS encore

| Fonctionnalité | Raison |
|---|---|
| Impression ticket thermique | Abstraction prévue, pas d'intégration matériel |
| Analytics avancées | Complexité non justifiée au MVP |
| Notifications push mobile | Reporté post-MVP |
| Gestion des stocks | Hors périmètre MVP |
| Fidélité client | Hors périmètre MVP |
| Intégration paiement en ligne | Hors périmètre MVP |
| Multi-devise | Reporté |

### Principes de conception

1. **Mobile-first pour le serveur** : l'Android est le coeur opérationnel
2. **Offline-first Android** : jamais de blocage réseau en salle
3. **Temps réel cuisine** : WebSocket STOMP, pas de polling
4. **Multi-tenant dès le début** : `restaurant_id` partout
5. **Séparation stricte** : backend/web/android = 3 repos
6. **Sécurité** : JWT + RBAC + validation stricte + tenant isolation

### Flux utilisateurs principaux

```
FLUX COMMANDE STANDARD
Serveur (Android)
  → Sélectionne table
  → Ajoute articles au panier
  → Envoie commande (PENDING → SENT_TO_KITCHEN)
  → Backend persiste + broadcast WebSocket cuisine
  → Cuisine reçoit en temps réel (statut: PENDING)
  → Cuisine marque PREPARING → READY
  → Serveur notifié → sert la table
  → Serveur demande paiement → saisit montant + mode
  → Commande → PAID → table libérée

FLUX OFFLINE
Serveur (Android, sans réseau)
  → Actions enregistrées localement (SQLite)
  → Réseau revient → sync automatique /api/sync/batch
  → Backend déduplique par client_uuid
  → Conflits résolus par timestamp

FLUX CUISINE
WebSocket /ws/kitchen/{restaurantId}
  → Nouvelle commande → broadcast STOMP topic
  → Cuisine reçoit OrderEvent
  → Affichage en colonne par statut
  → Cuisine change statut → backend → broadcast à tous les connectés
```

---

## 2. Architecture Système

### Composants

```
cfg/
├── cfg-backend/          # Spring Boot 3.x, Java 21
├── cfg-web/              # React 18 + Vite (Admin + Cuisine)
├── cfg-android/          # Android natif Kotlin
└── docker/               # Docker Compose VPS
```

### Stratégie Temps Réel

**WebSocket STOMP** via Spring `@EnableWebSocketMessageBroker`.

- Topic cuisine : `/topic/kitchen/{restaurantId}`
- Topic table : `/topic/table/{restaurantId}/{tableId}`
- Endpoint connexion : `/ws`
- Auth WS : JWT en query param au handshake

Justification STOMP vs SSE vs polling :
- STOMP : bidirectionnel, reconnexion gérée, broadcast natif Spring
- SSE : unidirectionnel uniquement, pas adapté si cuisine peut changer statut
- Polling : latence inacceptable pour une cuisine

### Stratégie Offline Sync

```
Android SQLite (sync_queue table)
  ├── uuid client unique par action
  ├── type: CREATE_ORDER | UPDATE_ORDER | ADD_ITEM | UPDATE_PAYMENT
  ├── payload: JSON
  ├── timestamp local
  ├── status: PENDING | SYNCED | CONFLICT
  └── retry_count

POST /api/sync/batch
  Body: [{ clientUuid, type, payload, localTimestamp }]
  → Backend idempotence par clientUuid
  → Retourne: [{ clientUuid, status, serverResponse }]
```

### Stratégie Multi-Tenant

- **Isolation par colonne** : `restaurant_id` sur toutes les tables métier
- **Pas d'isolation schéma** au MVP (ajout possible sans réécriture)
- Middleware Spring : extraction `restaurantId` du JWT → injection dans chaque requête
- Validation : chaque accès vérifie `user.restaurantId == resource.restaurantId`

### Stratégie Sécurité

- JWT access token (15min) + refresh token (7j) via Redis
- RBAC : 5 rôles avec Spring Security `@PreAuthorize`
- HTTPS obligatoire (Nginx SSL termination)
- Rate limiting Nginx + Spring `@RateLimiter`
- Validation : Bean Validation sur tous les DTOs
- SQL injection : JPA uniquement, pas de SQL natif sans paramètre
- CORS : whitelist stricte des origins

### Rôles

| Rôle | Description | Justification |
|---|---|---|
| `SUPER_ADMIN` | Plateforme entière, tous les restaurants | Gestion SaaS |
| `OWNER` | Un restaurant, accès complet | Propriétaire/Gérant |
| `MANAGER` | Un restaurant, accès opérationnel sans facturation | Responsable de salle |
| `WAITER` | Un restaurant, prise de commande | Serveur |
| `KITCHEN` | Un restaurant, lecture cuisine uniquement | Cuisinier |

> `MANAGER` justifié : besoin réel en restauration d'un intermédiaire entre Owner et Waiter (gestion planning, accès rapports sans accès facturation/config).

### Stratégie Monitoring & Logs

- **Logs** : Logback + format JSON → fichier + stdout (Loki-ready)
- **Metrics** : Spring Actuator → Prometheus endpoint `/actuator/prometheus`
- **Health** : `/actuator/health` pour Docker healthcheck
- **Audit** : table `audit_logs` pour actions critiques (paiements, suppressions)
- Stack future : Prometheus + Grafana (Docker Compose ready)

---

## 3. Structure des Dépôts

### cfg-backend

```
cfg-backend/
├── src/main/java/com/cfg/
│   ├── CfgApplication.java
│   ├── config/
│   │   ├── SecurityConfig.java
│   │   ├── WebSocketConfig.java
│   │   ├── JpaConfig.java
│   │   └── RedisConfig.java
│   ├── common/
│   │   ├── domain/
│   │   │   ├── BaseEntity.java        # id, createdAt, updatedAt
│   │   │   └── TenantAwareEntity.java # + restaurantId
│   │   ├── dto/
│   │   │   ├── ApiResponse.java
│   │   │   ├── PageResponse.java
│   │   │   └── ErrorResponse.java
│   │   ├── exception/
│   │   │   ├── GlobalExceptionHandler.java
│   │   │   ├── ResourceNotFoundException.java
│   │   │   ├── UnauthorizedException.java
│   │   │   └── TenantAccessException.java
│   │   ├── security/
│   │   │   ├── JwtService.java
│   │   │   ├── JwtAuthFilter.java
│   │   │   ├── UserPrincipal.java
│   │   │   └── TenantContext.java
│   │   └── util/
│   │       ├── SlugUtils.java
│   │       └── PhoneUtils.java
│   ├── restaurant/
│   │   ├── domain/Restaurant.java
│   │   ├── repository/RestaurantRepository.java
│   │   ├── service/RestaurantService.java
│   │   ├── controller/RestaurantController.java
│   │   └── dto/
│   ├── user/
│   │   ├── domain/
│   │   │   ├── User.java
│   │   │   └── Role.java (enum)
│   │   ├── repository/UserRepository.java
│   │   ├── service/UserService.java
│   │   ├── controller/
│   │   │   ├── AuthController.java
│   │   │   └── UserController.java
│   │   └── dto/
│   ├── table/
│   │   ├── domain/RestaurantTable.java
│   │   ├── repository/TableRepository.java
│   │   ├── service/TableService.java
│   │   ├── controller/TableController.java
│   │   └── dto/
│   ├── menu/
│   │   ├── domain/
│   │   │   ├── MenuCategory.java
│   │   │   ├── MenuItem.java
│   │   │   └── MenuItemModifier.java
│   │   ├── repository/
│   │   ├── service/MenuService.java
│   │   ├── controller/MenuController.java
│   │   └── dto/
│   ├── order/
│   │   ├── domain/
│   │   │   ├── Order.java
│   │   │   ├── OrderItem.java
│   │   │   ├── OrderStatus.java (enum)
│   │   │   └── OrderItemModifier.java
│   │   ├── repository/
│   │   ├── service/
│   │   │   ├── OrderService.java
│   │   │   └── OrderEventPublisher.java
│   │   ├── controller/
│   │   │   ├── OrderController.java
│   │   │   └── KitchenController.java
│   │   └── dto/
│   ├── payment/
│   │   ├── domain/
│   │   │   ├── Payment.java
│   │   │   └── PaymentMethod.java (enum)
│   │   ├── repository/PaymentRepository.java
│   │   ├── service/PaymentService.java
│   │   ├── controller/PaymentController.java
│   │   └── dto/
│   ├── sync/
│   │   ├── domain/SyncEvent.java
│   │   ├── repository/SyncEventRepository.java
│   │   ├── service/SyncService.java
│   │   ├── controller/SyncController.java
│   │   └── dto/
│   └── kitchen/
│       ├── websocket/
│       │   ├── KitchenWebSocketController.java
│       │   └── OrderEventMessage.java
│       └── printer/
│           ├── PrinterService.java      # Interface abstraite
│           └── NoOpPrinterService.java  # Implémentation vide MVP
├── src/main/resources/
│   ├── application.yml
│   ├── application-dev.yml
│   ├── application-prod.yml
│   └── db/migration/
│       ├── V1__init_schema.sql
│       ├── V2__seed_roles.sql
│       └── V3__seed_demo.sql
├── src/test/java/com/cfg/
│   ├── order/OrderServiceTest.java
│   ├── payment/PaymentServiceTest.java
│   └── sync/SyncServiceTest.java
├── Dockerfile
├── pom.xml
└── .env.example
```

### cfg-web

```
cfg-web/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router/
│   │   ├── index.tsx
│   │   ├── AdminRoutes.tsx
│   │   └── KitchenRoutes.tsx
│   ├── store/
│   │   ├── index.ts              # Zustand store root
│   │   ├── authStore.ts
│   │   ├── orderStore.ts
│   │   └── kitchenStore.ts
│   ├── api/
│   │   ├── client.ts             # Axios instance + interceptors
│   │   ├── auth.ts
│   │   ├── orders.ts
│   │   ├── menus.ts
│   │   ├── tables.ts
│   │   ├── payments.ts
│   │   └── restaurants.ts
│   ├── hooks/
│   │   ├── useWebSocket.ts       # STOMP hook
│   │   ├── useAuth.ts
│   │   └── useRestaurant.ts
│   ├── types/
│   │   ├── order.ts
│   │   ├── menu.ts
│   │   ├── payment.ts
│   │   └── user.ts
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── admin/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── OrdersPage.tsx
│   │   │   ├── MenuPage.tsx
│   │   │   ├── TablesPage.tsx
│   │   │   ├── UsersPage.tsx
│   │   │   ├── PaymentsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   └── kitchen/
│   │       └── KitchenBoardPage.tsx
│   ├── components/
│   │   ├── common/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── orders/
│   │   │   ├── OrderCard.tsx
│   │   │   ├── OrderList.tsx
│   │   │   └── OrderStatusBadge.tsx
│   │   ├── kitchen/
│   │   │   ├── KitchenColumn.tsx
│   │   │   ├── KitchenOrderCard.tsx
│   │   │   └── KitchenStatusBar.tsx
│   │   ├── menu/
│   │   │   ├── MenuCategoryForm.tsx
│   │   │   ├── MenuItemForm.tsx
│   │   │   └── MenuItemCard.tsx
│   │   └── payments/
│   │       ├── PaymentForm.tsx
│   │       └── PaymentMethodBadge.tsx
│   └── utils/
│       ├── format.ts
│       ├── constants.ts
│       └── ws.ts
├── public/
├── Dockerfile
├── nginx.conf
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

### cfg-android

```
cfg-android/
├── app/
│   ├── src/main/
│   │   ├── java/com/cfg/android/
│   │   │   ├── CfgApplication.kt
│   │   │   ├── di/
│   │   │   │   ├── AppModule.kt        # Hilt modules
│   │   │   │   ├── NetworkModule.kt
│   │   │   │   └── DatabaseModule.kt
│   │   │   ├── data/
│   │   │   │   ├── local/
│   │   │   │   │   ├── AppDatabase.kt  # Room DB
│   │   │   │   │   ├── dao/
│   │   │   │   │   │   ├── OrderDao.kt
│   │   │   │   │   │   ├── SyncQueueDao.kt
│   │   │   │   │   │   └── MenuDao.kt
│   │   │   │   │   └── entity/
│   │   │   │   │       ├── OrderEntity.kt
│   │   │   │   │       ├── SyncQueueEntity.kt
│   │   │   │   │       └── MenuItemEntity.kt
│   │   │   │   ├── remote/
│   │   │   │   │   ├── ApiService.kt   # Retrofit
│   │   │   │   │   ├── dto/
│   │   │   │   │   └── interceptor/
│   │   │   │   │       ├── AuthInterceptor.kt
│   │   │   │   │       └── ConnectivityInterceptor.kt
│   │   │   │   └── repository/
│   │   │   │       ├── OrderRepository.kt
│   │   │   │       ├── MenuRepository.kt
│   │   │   │       └── SyncRepository.kt
│   │   │   ├── domain/
│   │   │   │   ├── model/
│   │   │   │   │   ├── Order.kt
│   │   │   │   │   ├── OrderItem.kt
│   │   │   │   │   ├── MenuItem.kt
│   │   │   │   │   └── Table.kt
│   │   │   │   └── usecase/
│   │   │   │       ├── CreateOrderUseCase.kt
│   │   │   │       ├── AddItemToOrderUseCase.kt
│   │   │   │       ├── TransferOrderUseCase.kt
│   │   │   │       └── SyncPendingActionsUseCase.kt
│   │   │   ├── ui/
│   │   │   │   ├── theme/
│   │   │   │   │   ├── Color.kt
│   │   │   │   │   ├── Theme.kt
│   │   │   │   │   └── Type.kt
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginActivity.kt
│   │   │   │   │   └── LoginViewModel.kt
│   │   │   │   ├── tables/
│   │   │   │   │   ├── TableListFragment.kt
│   │   │   │   │   └── TableListViewModel.kt
│   │   │   │   ├── order/
│   │   │   │   │   ├── OrderFragment.kt
│   │   │   │   │   ├── OrderViewModel.kt
│   │   │   │   │   ├── CartFragment.kt
│   │   │   │   │   └── CartViewModel.kt
│   │   │   │   ├── menu/
│   │   │   │   │   ├── MenuFragment.kt
│   │   │   │   │   └── MenuViewModel.kt
│   │   │   │   └── payment/
│   │   │   │       ├── PaymentFragment.kt
│   │   │   │       └── PaymentViewModel.kt
│   │   │   ├── service/
│   │   │   │   └── SyncWorker.kt       # WorkManager
│   │   │   └── util/
│   │   │       ├── NetworkMonitor.kt
│   │   │       ├── TokenManager.kt
│   │   │       └── Extensions.kt
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   ├── navigation/nav_graph.xml
│   │   │   ├── values/
│   │   │   └── drawable/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

---

## 4. Schéma Base de Données

### Vue Globale

```sql
-- TENANTS
restaurants
  └── users (staff)
  └── restaurant_tables
  └── menu_categories
      └── menu_items
          └── menu_item_modifiers
  └── orders
      └── order_items
          └── order_item_modifiers
      └── payments

-- PLATEFORME
platform_admins  (SUPER_ADMIN séparé des users restaurant)
audit_logs
sync_events
```

### DDL Complet

Voir `cfg-backend/src/main/resources/db/migration/V1__init_schema.sql`

### Index Critiques

```sql
-- Performance requêtes fréquentes
idx_orders_restaurant_status     ON orders(restaurant_id, status)
idx_orders_table_active           ON orders(table_id, status) WHERE status NOT IN ('PAID','CANCELLED')
idx_order_items_order             ON order_items(order_id)
idx_users_restaurant              ON users(restaurant_id)
idx_menu_items_category           ON menu_items(category_id, is_available)
idx_sync_events_status            ON sync_events(status, created_at)
```

---

## 5. Endpoints API

Base URL : `https://api.cfg.app/api/v1`

### Auth

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/login` | Login email ou téléphone |
| POST | `/auth/refresh` | Renouveler access token |
| POST | `/auth/logout` | Invalider refresh token |
| GET | `/auth/me` | Profil utilisateur courant |

### Restaurants

| Méthode | Route | Rôle minimum |
|---|---|---|
| GET | `/restaurants` | SUPER_ADMIN |
| POST | `/restaurants` | SUPER_ADMIN |
| GET | `/restaurants/{id}` | OWNER |
| PUT | `/restaurants/{id}` | OWNER |
| DELETE | `/restaurants/{id}` | SUPER_ADMIN |
| GET | `/restaurants/{id}/stats` | OWNER |

### Tables

| Méthode | Route | Rôle minimum |
|---|---|---|
| GET | `/restaurants/{restaurantId}/tables` | WAITER |
| POST | `/restaurants/{restaurantId}/tables` | MANAGER |
| PUT | `/restaurants/{restaurantId}/tables/{id}` | MANAGER |
| DELETE | `/restaurants/{restaurantId}/tables/{id}` | MANAGER |

### Menus

| Méthode | Route | Rôle minimum |
|---|---|---|
| GET | `/restaurants/{restaurantId}/menu` | WAITER |
| POST | `/restaurants/{restaurantId}/categories` | MANAGER |
| PUT | `/restaurants/{restaurantId}/categories/{id}` | MANAGER |
| DELETE | `/restaurants/{restaurantId}/categories/{id}` | MANAGER |
| POST | `/restaurants/{restaurantId}/items` | MANAGER |
| PUT | `/restaurants/{restaurantId}/items/{id}` | MANAGER |
| DELETE | `/restaurants/{restaurantId}/items/{id}` | MANAGER |
| PATCH | `/restaurants/{restaurantId}/items/{id}/availability` | MANAGER |

### Commandes

| Méthode | Route | Rôle minimum |
|---|---|---|
| GET | `/restaurants/{restaurantId}/orders` | WAITER |
| POST | `/restaurants/{restaurantId}/orders` | WAITER |
| GET | `/restaurants/{restaurantId}/orders/{id}` | WAITER |
| PUT | `/restaurants/{restaurantId}/orders/{id}` | WAITER |
| PATCH | `/restaurants/{restaurantId}/orders/{id}/status` | KITCHEN |
| POST | `/restaurants/{restaurantId}/orders/{id}/transfer` | WAITER |
| POST | `/restaurants/{restaurantId}/orders/{id}/items` | WAITER |
| DELETE | `/restaurants/{restaurantId}/orders/{id}/items/{itemId}` | WAITER |

### Paiements

| Méthode | Route | Rôle minimum |
|---|---|---|
| POST | `/restaurants/{restaurantId}/orders/{id}/payment` | WAITER |
| GET | `/restaurants/{restaurantId}/payments` | MANAGER |
| GET | `/restaurants/{restaurantId}/payments/{id}` | MANAGER |

### Kitchen Board

| Méthode | Route | Description |
|---|---|---|
| GET | `/restaurants/{restaurantId}/kitchen/board` | Commandes actives cuisine |
| PATCH | `/restaurants/{restaurantId}/kitchen/orders/{id}/status` | Changer statut depuis cuisine |
| WS | `/ws` (STOMP) | Connexion WebSocket |
| STOMP | `/topic/kitchen/{restaurantId}` | Topic commandes cuisine |

### Synchronisation Offline

| Méthode | Route | Description |
|---|---|---|
| POST | `/sync/batch` | Envoyer actions en attente |
| GET | `/sync/status/{clientUuid}` | Vérifier statut sync |

### Utilisateurs

| Méthode | Route | Rôle minimum |
|---|---|---|
| GET | `/restaurants/{restaurantId}/users` | MANAGER |
| POST | `/restaurants/{restaurantId}/users` | OWNER |
| PUT | `/restaurants/{restaurantId}/users/{id}` | OWNER |
| DELETE | `/restaurants/{restaurantId}/users/{id}` | OWNER |
| PATCH | `/restaurants/{restaurantId}/users/{id}/role` | OWNER |

---

## 6. Architecture Interface

### Web Admin (React)

```
Routes:
/login                     → LoginPage (tous)
/admin/dashboard           → DashboardPage (OWNER, MANAGER)
/admin/orders              → OrdersPage (OWNER, MANAGER)
/admin/tables              → TablesPage (MANAGER)
/admin/menu                → MenuPage (MANAGER)
/admin/users               → UsersPage (OWNER)
/admin/payments            → PaymentsPage (OWNER, MANAGER)
/admin/settings            → SettingsPage (OWNER)
/kitchen                   → KitchenBoardPage (KITCHEN)
```

### Web Cuisine (React — même app, route /kitchen)

**KitchenBoardPage** : affichage kanban en colonnes
- Colonne PENDING : nouvelles commandes
- Colonne PREPARING : en cours
- Colonne READY : prêt à servir
- Connexion WebSocket auto au chargement
- Reconnexion automatique si déconnexion

### Mobile Android (Serveur)

```
Screens:
LoginScreen       → TableListScreen
TableListScreen   → OrderScreen (par table)
OrderScreen       → MenuBrowserScreen (ajouter articles)
MenuBrowserScreen → OrderScreen (retour avec articles)
OrderScreen       → CartReviewScreen
CartReviewScreen  → PaymentScreen
PaymentScreen     → TableListScreen (boucle)
```

---

## 7. Implémentation

Voir les sous-répertoires :
- `cfg-backend/` — Spring Boot complet
- `cfg-web/` — React complet
- `cfg-android/` — Android Kotlin complet

---

## 8. Déploiement

### Docker Compose (VPS)

Voir `docker/docker-compose.yml`

### Ports

| Service | Port interne | Port exposé |
|---|---|---|
| Nginx | 80, 443 | 80, 443 |
| Backend | 8080 | — (via Nginx) |
| Frontend | 3000 | — (via Nginx) |
| PostgreSQL | 5432 | 5432 (localhost only) |
| Redis | 6379 | — (interne) |

### Variables d'environnement

Voir `.env.example` à la racine.

---

## 9. Évolution Future

| Besoin | Évolution |
|---|---|
| Plus d'utilisateurs | Redis cluster + Spring session distribué |
| Plus de restaurants | Isolation par schéma PostgreSQL (schema-per-tenant) |
| Plus de charge | Découpage microservices (order-service, menu-service) |
| Impression ticket | Implémenter `PrinterService` interface (ESC/POS via réseau/BT) |
| Analytics | ClickHouse ou TimescaleDB pour séries temporelles |
| Notifications push | Firebase FCM intégré dans SyncWorker Android |
| Paiements avancés | Stripe / intégration opérateurs mobiles directs |
| CI/CD | GitHub Actions → Docker build → push registry → deploy VPS |

---

## 10. Lancement Local

### Prérequis
- Java 21+
- Node 20+
- Android Studio (Hedgehog+)
- Docker Desktop

### Backend

```bash
cd cfg-backend
cp .env.example .env
# Éditer .env avec vos valeurs
docker compose up -d postgres redis
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

### Web

```bash
cd cfg-web
cp .env.example .env.local
npm install
npm run dev
# Admin: http://localhost:5173/admin
# Cuisine: http://localhost:5173/kitchen
```

### Android

```
Ouvrir cfg-android dans Android Studio
Éditer app/src/main/res/raw/config.json avec l'URL du backend
Run sur émulateur ou device (API 26+)
```

### Docker Complet (VPS)

```bash
cd docker
cp .env.example .env
# Éditer .env
docker compose up -d
# Backend: http://localhost:8080
# Frontend: http://localhost:3000
```

---

## Changelog

| Date | Version | Description |
|---|---|---|
| 2026-06-29 | 0.1.0 | Architecture initiale, structure complète, README |
