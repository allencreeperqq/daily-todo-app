export interface Task {
  id: number
  title: string
  notes: string | null
  due_at: string | null
  priority: number
  category: string | null
  recurrence_rule: string | null
  completed_at: string | null
  source: string
  remote_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  title: string
  notes?: string | null
  due_at?: string | null
  priority?: number
  category?: string | null
}

export type TaskPatch = Partial<CreateTaskInput>

export interface Account {
  id: number
  name: string
  type: string
  created_at: string
}

export interface CreateAccountInput {
  name: string
  type?: string
}

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: number
  account_id: number
  type: TransactionType
  amount: number
  category: string | null
  note: string | null
  occurred_at: string
  created_at: string
}

export interface CreateTransactionInput {
  account_id: number
  type: TransactionType
  amount: number
  category?: string | null
  note?: string | null
  occurred_at?: string
}

export interface Budget {
  id: number
  category: string
  monthly_limit: number
  created_at: string
}

export interface CreateBudgetInput {
  category: string
  monthly_limit: number
}

export interface CategorySpend {
  category: string
  total: number
}

export interface MonthlySummary {
  month: string
  income: number
  expense: number
  net: number
  byCategory: CategorySpend[]
}

export interface CalendarEvent {
  id: number
  google_event_id: string | null
  title: string
  location: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  source: string
  synced_at: string
}

export interface GoogleAuthStatus {
  configured: boolean
  connected: boolean
}

export interface SyncResult {
  count: number
}

export interface PluginInfo {
  id: string
  name: string
  version: string
}

export interface PluginCommandInfo {
  id: string
  pluginId: string
  label: string
}

export interface PluginsList {
  plugins: PluginInfo[]
  commands: PluginCommandInfo[]
}

export interface DailyTodoApi {
  tasks: {
    list(): Promise<Task[]>
    create(input: CreateTaskInput): Promise<Task>
    update(id: number, patch: TaskPatch): Promise<Task | undefined>
    toggle(id: number, completed: boolean): Promise<Task | undefined>
    delete(id: number): Promise<void>
  }
  finance: {
    listAccounts(): Promise<Account[]>
    createAccount(input: CreateAccountInput): Promise<Account>
    listTransactions(month?: string): Promise<Transaction[]>
    createTransaction(input: CreateTransactionInput): Promise<Transaction>
    deleteTransaction(id: number): Promise<void>
    listBudgets(): Promise<Budget[]>
    upsertBudget(input: CreateBudgetInput): Promise<Budget>
    deleteBudget(id: number): Promise<void>
    getMonthlySummary(month?: string): Promise<MonthlySummary>
    getRecentTrend(monthsBack?: number): Promise<MonthlySummary[]>
  }
  calendar: {
    getGoogleAuthStatus(): Promise<GoogleAuthStatus>
    setGoogleClientConfig(clientId: string, clientSecret: string): Promise<void>
    connectGoogle(): Promise<void>
    disconnectGoogle(): Promise<void>
    syncGoogle(): Promise<SyncResult>
    listEvents(fromIso: string, toIso: string): Promise<CalendarEvent[]>
  }
  shell: {
    openExternal(url: string): Promise<void>
  }
  plugins: {
    list(): Promise<PluginsList>
    run(commandId: string): Promise<void>
  }
  notifications: {
    test(): Promise<void>
  }
}
