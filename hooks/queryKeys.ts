/**
 * Query key factory tập trung cho React Query (epic #58).
 *
 * Mục đích: 1 nguồn sự thật cho mọi queryKey → tránh string trùng/lệch giữa các consumer
 * (vd OrderForm vs OrderList phải cùng `['orders']`, nếu một bên `['orders', undefined]`
 * sẽ tách cache → fetch đôi, data lệch). Mỗi domain có `.all` (list) và optional key con
 * cho query có tham số (detail/list-by-param).
 *
 * Quy ước:
 * - `all` = key gốc của domain (dùng để invalidate cả domain sau mutation).
 * - Key con kế thừa `all` ở phần tử đầu để `invalidateQueries({ queryKey: qk.x.all })`
 *   xoá luôn các key con (prefix match của React Query).
 *
 * Các phase sau dùng dần các entry dưới đây.
 */
export const qk = {
  orders: {
    all: ['orders'] as const,
    nextNumber: () => ['orders', 'next-number'] as const,
    refunds: ['orders', 'refunds'] as const,
  },
  network: {
    status: ['network', 'status'] as const,
    guard: ['network', 'guard'] as const,
    ranges: ['network', 'ranges'] as const,
  },
  customers: {
    all: ['customers'] as const,
  },
  employees: {
    all: ['employees'] as const,
    wages: (employeeId: string) => ['employees', 'wages', employeeId] as const,
  },
  attendance: {
    me: ['attendance', 'me'] as const,
    overview: ['attendance', 'overview'] as const,
    networks: ['attendance', 'networks'] as const,
    history: (params: unknown) => ['attendance', 'history', params] as const,
    payroll: (params: unknown) => ['attendance', 'payroll', params] as const,
    adjustments: (params: unknown) => ['attendance', 'adjustments', params] as const,
  },
  shifts: {
    defs: ['shifts', 'defs'] as const,
    assignments: (from: string, to: string) =>
      ['shifts', 'assignments', from, to] as const,
  },
  calendar: {
    events: (from: string, to: string) =>
      ['calendar', 'events', from, to] as const,
  },
  wages: {
    all: ['wages'] as const,
  },
  products: {
    all: ['products'] as const,
    versions: (productId: string) => ['products', 'versions', productId] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  flavors: {
    all: ['flavors'] as const,
  },
  badges: {
    all: ['badges'] as const,
  },
  surchargeTags: {
    all: ['surcharge-tags'] as const,
  },
  promotions: {
    all: ['promotions'] as const,
    preview: (params: unknown) => ['promotions', 'preview', params] as const,
  },
  commission: {
    summaries: ['commission', 'summaries'] as const,
    mine: (uid: string) => ['commission', 'mine', uid] as const,
    groups: ['commission', 'groups'] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    byOrderNumber: (orderNumber: string) => ['transactions', 'by-order', orderNumber] as const,
    ledger: (params: unknown) => ['transactions', 'ledger', params] as const,
  },
  revenue: {
    report: (params: unknown) => ['revenue', 'report', params] as const,
  },
  shippingConfig: {
    all: ['shipping-config'] as const,
  },
  paymentAccounts: {
    all: ['payment-accounts'] as const,
  },
  screenConfig: {
    all: ['screen-config'] as const,
  },
  zaloConfig: {
    groups: ['zalo-config', 'groups'] as const,
  },
  users: {
    all: ['users'] as const,
    byUid: (uid: string) => ['users', 'uid', uid] as const,
    byEmail: (email: string) => ['users', 'email', email] as const,
  },
  requestLogs: {
    list: (query: unknown) => ['request-logs', 'list', query] as const,
    stats: (query: unknown) => ['request-logs', 'stats', query] as const,
    timeseries: (query: unknown) => ['request-logs', 'timeseries', query] as const,
    errorGroups: (query: unknown) => ['request-logs', 'error-groups', query] as const,
    health: ['request-logs', 'health'] as const,
  },
  notifications: {
    log: (query: unknown) => ['notifications', 'log', query] as const,
    inbox: ['notifications', 'inbox'] as const,
    unread: ['notifications', 'unread'] as const,
  },
  stockReceipt: {
    suppliers: ['stock-receipt', 'suppliers'] as const,
    materials: ['stock-receipt', 'materials'] as const,
    materialPriceOptions: ['stock-receipt', 'material-price-options'] as const,
    materialMergeSuggestions: (threshold: number) =>
      ['stock-receipt', 'material-merge-suggestions', threshold] as const,
    summaries: ['stock-receipt', 'summaries'] as const,
    detail: (id: string) => ['stock-receipt', 'detail', id] as const,
  },
} as const;
