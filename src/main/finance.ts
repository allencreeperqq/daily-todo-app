import { getDb } from './db'
import type {
  Account,
  Budget,
  CreateAccountInput,
  CreateBudgetInput,
  CreateTransactionInput,
  MonthlySummary,
  Transaction
} from '../shared/types'

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function listAccounts(): Account[] {
  return getDb().prepare('SELECT * FROM accounts ORDER BY id ASC').all() as unknown as Account[]
}

export function createAccount(input: CreateAccountInput): Account {
  const result = getDb()
    .prepare('INSERT INTO accounts (name, type) VALUES (@name, @type)')
    .run({ name: input.name, type: input.type ?? 'cash' })
  return getDb()
    .prepare('SELECT * FROM accounts WHERE id = ?')
    .get(result.lastInsertRowid) as unknown as Account
}

export function listTransactions(month?: string): Transaction[] {
  const targetMonth = month ?? currentMonth()
  return getDb()
    .prepare(
      `SELECT * FROM transactions
       WHERE substr(occurred_at, 1, 7) = ?
       ORDER BY occurred_at DESC, id DESC`
    )
    .all(targetMonth) as unknown as Transaction[]
}

export function createTransaction(input: CreateTransactionInput): Transaction {
  const result = getDb()
    .prepare(
      `INSERT INTO transactions (account_id, type, amount, category, note, occurred_at)
       VALUES (@account_id, @type, @amount, @category, @note, @occurred_at)`
    )
    .run({
      account_id: input.account_id,
      type: input.type,
      amount: input.amount,
      category: input.category ?? null,
      note: input.note ?? null,
      occurred_at: input.occurred_at ?? new Date().toISOString()
    })
  return getDb()
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(result.lastInsertRowid) as unknown as Transaction
}

export function deleteTransaction(id: number): void {
  getDb().prepare('DELETE FROM transactions WHERE id = ?').run(id)
}

export function listBudgets(): Budget[] {
  return getDb()
    .prepare('SELECT * FROM budgets ORDER BY category ASC')
    .all() as unknown as Budget[]
}

export function upsertBudget(input: CreateBudgetInput): Budget {
  getDb()
    .prepare(
      `INSERT INTO budgets (category, monthly_limit) VALUES (@category, @monthly_limit)
       ON CONFLICT(category) DO UPDATE SET monthly_limit = excluded.monthly_limit`
    )
    .run({ category: input.category, monthly_limit: input.monthly_limit })
  return getDb()
    .prepare('SELECT * FROM budgets WHERE category = ?')
    .get(input.category) as unknown as Budget
}

export function deleteBudget(id: number): void {
  getDb().prepare('DELETE FROM budgets WHERE id = ?').run(id)
}

export function getMonthlySummary(month?: string): MonthlySummary {
  const targetMonth = month ?? currentMonth()
  const rows = listTransactions(targetMonth)

  let income = 0
  let expense = 0
  const categoryTotals = new Map<string, number>()

  for (const tx of rows) {
    if (tx.type === 'income') {
      income += tx.amount
      continue
    }
    expense += tx.amount
    const key = tx.category?.trim() || '未分類'
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + tx.amount)
  }

  const byCategory = [...categoryTotals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)

  return { month: targetMonth, income, expense, net: income - expense, byCategory }
}

export function getRecentMonthlySummaries(monthsBack = 6): MonthlySummary[] {
  const now = new Date()
  const months: string[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months.map((m) => getMonthlySummary(m))
}
