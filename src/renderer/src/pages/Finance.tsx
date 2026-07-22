import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  Account,
  Budget,
  MonthlySummary,
  Transaction,
  TransactionType
} from '../../../shared/types'
import DonutChart, { seriesColor, usePrefersDark, type DonutSlice } from '../components/DonutChart'
import TrendChart from '../components/TrendChart'

const COMMON_CATEGORIES = ['餐飲', '交通', '購物', '娛樂', '居家', '醫療', '其他']

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y} 年 ${m} 月`
}

function formatAmount(n: number): string {
  return '$' + n.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
}

export default function Finance() {
  const [month, setMonth] = useState(currentMonthKey())
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [trend, setTrend] = useState<MonthlySummary[]>([])
  const [loading, setLoading] = useState(true)
  const isDark = usePrefersDark()

  const [txType, setTxType] = useState<TransactionType>('expense')
  const [txAmount, setTxAmount] = useState('')
  const [txCategory, setTxCategory] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [txAccountId, setTxAccountId] = useState<number | null>(null)

  const [budgetCategory, setBudgetCategory] = useState('')
  const [budgetLimit, setBudgetLimit] = useState('')

  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('cash')
  const [accountMessage, setAccountMessage] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    const [accountList, txList, budgetList, monthlySummary, trendData] = await Promise.all([
      window.api.finance.listAccounts(),
      window.api.finance.listTransactions(month),
      window.api.finance.listBudgets(),
      window.api.finance.getMonthlySummary(month),
      window.api.finance.getRecentTrend(6)
    ])
    setAccounts(accountList)
    setTransactions(txList)
    setBudgets(budgetList)
    setSummary(monthlySummary)
    setTrend(trendData)
    setTxAccountId((current) => current ?? accountList[0]?.id ?? null)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const categoryOptions = useMemo(() => {
    const set = new Set(COMMON_CATEGORIES)
    for (const b of budgets) set.add(b.category)
    return [...set]
  }, [budgets])

  const donutData: DonutSlice[] = useMemo(() => {
    if (!summary) return []
    const top = summary.byCategory.slice(0, 8)
    const rest = summary.byCategory.slice(8)
    const slices = top.map((c, i) => ({
      label: c.category,
      value: c.total,
      color: seriesColor(i, isDark)
    }))
    const otherTotal = rest.reduce((sum, c) => sum + c.total, 0)
    if (otherTotal > 0) slices.push({ label: '其他', value: otherTotal, color: seriesColor(8, isDark) })
    return slices
  }, [summary, isDark])

  async function handleAddTransaction(e: FormEvent): Promise<void> {
    e.preventDefault()
    const amount = parseFloat(txAmount)
    if (!amount || amount <= 0 || !txAccountId) return

    await window.api.finance.createTransaction({
      account_id: txAccountId,
      type: txType,
      amount,
      category: txCategory.trim() || null,
      note: txNote.trim() || null,
      occurred_at: new Date(txDate).toISOString()
    })
    setTxAmount('')
    setTxCategory('')
    setTxNote('')
    await refresh()
  }

  async function handleDeleteTransaction(id: number): Promise<void> {
    await window.api.finance.deleteTransaction(id)
    await refresh()
  }

  async function handleSaveBudget(e: FormEvent): Promise<void> {
    e.preventDefault()
    const limit = parseFloat(budgetLimit)
    if (!budgetCategory.trim() || !limit || limit <= 0) return

    await window.api.finance.upsertBudget({ category: budgetCategory.trim(), monthly_limit: limit })
    setBudgetCategory('')
    setBudgetLimit('')
    await refresh()
  }

  async function handleDeleteBudget(id: number): Promise<void> {
    await window.api.finance.deleteBudget(id)
    await refresh()
  }

  async function handleAddAccount(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!accountName.trim()) return
    await window.api.finance.createAccount({ name: accountName.trim(), type: accountType })
    setAccountName('')
    setAccountMessage(null)
    await refresh()
  }

  async function handleDeleteAccount(id: number): Promise<void> {
    const result = await window.api.finance.deleteAccount(id)
    if (!result.ok) {
      setAccountMessage(result.message ?? '刪除失敗')
      return
    }
    setAccountMessage(null)
    await refresh()
  }

  if (loading || !summary) return <p className="loading">載入中...</p>

  return (
    <div className="finance-page">
      <div className="finance-header">
        <h1>記帳</h1>
        <div className="month-nav">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="上個月">
            ‹
          </button>
          <span>{monthLabel(month)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="下個月">
            ›
          </button>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">收入</span>
          <span className="stat-value income">{formatAmount(summary.income)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">支出</span>
          <span className="stat-value expense">{formatAmount(summary.expense)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">淨額</span>
          <span className={`stat-value ${summary.net >= 0 ? 'income' : 'expense'}`}>
            {formatAmount(summary.net)}
          </span>
        </div>
      </div>

      <section className="trend-section">
        <h2>近半年趨勢</h2>
        <TrendChart
          data={trend.map((s) => ({ month: s.month, income: s.income, expense: s.expense }))}
          formatValue={formatAmount}
        />
      </section>

      <section className="accounts-section">
        <h2>帳戶</h2>
        <form className="account-form" onSubmit={handleAddAccount}>
          <input
            type="text"
            placeholder="帳戶名稱(例如:銀行、信用卡...)"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
            <option value="cash">現金</option>
            <option value="bank">銀行</option>
            <option value="credit">信用卡</option>
          </select>
          <button type="submit">新增帳戶</button>
        </form>
        {accountMessage && <p className="settings-message">{accountMessage}</p>}
        <ul className="account-list">
          {accounts.map((a) => (
            <li key={a.id}>
              <span className="account-name">{a.name}</span>
              <span className="account-type">
                {a.type === 'cash' ? '現金' : a.type === 'bank' ? '銀行' : '信用卡'}
              </span>
              <button className="delete" onClick={() => handleDeleteAccount(a.id)}>
                刪除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form className="add-tx-form" onSubmit={handleAddTransaction}>
        <select value={txType} onChange={(e) => setTxType(e.target.value as TransactionType)}>
          <option value="expense">支出</option>
          <option value="income">收入</option>
        </select>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="金額"
          value={txAmount}
          onChange={(e) => setTxAmount(e.target.value)}
        />
        <input
          list="category-options"
          placeholder="分類"
          value={txCategory}
          onChange={(e) => setTxCategory(e.target.value)}
        />
        <datalist id="category-options">
          {categoryOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input
          type="text"
          placeholder="備註"
          value={txNote}
          onChange={(e) => setTxNote(e.target.value)}
        />
        <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        <select
          value={txAccountId ?? ''}
          onChange={(e) => setTxAccountId(Number(e.target.value))}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button type="submit">新增</button>
      </form>

      <div className="finance-columns">
        <section>
          <h2>分類支出</h2>
          <DonutChart
            data={donutData}
            centerLabel="本月支出"
            centerValue={formatAmount(summary.expense)}
            formatValue={formatAmount}
          />
        </section>

        <section>
          <h2>預算</h2>
          <form className="budget-form" onSubmit={handleSaveBudget}>
            <input
              list="category-options"
              placeholder="分類"
              value={budgetCategory}
              onChange={(e) => setBudgetCategory(e.target.value)}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="每月上限"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
            />
            <button type="submit">設定</button>
          </form>
          {budgets.length === 0 && <p className="empty">尚未設定任何預算</p>}
          <ul className="budget-list">
            {budgets.map((b) => {
              const spent = summary.byCategory.find((c) => c.category === b.category)?.total ?? 0
              const percent = Math.min(100, (spent / b.monthly_limit) * 100)
              const over = spent > b.monthly_limit
              return (
                <li key={b.id}>
                  <div className="bar-row">
                    <span className="bar-label">{b.category}</span>
                    <span className="bar-amount">
                      {formatAmount(spent)} / {formatAmount(b.monthly_limit)}
                    </span>
                    <button className="delete" onClick={() => handleDeleteBudget(b.id)}>
                      刪除
                    </button>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill${over ? ' over' : ''}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <section>
        <h2>本月明細 ({transactions.length})</h2>
        <ul className="tx-list">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <span className="tx-date">{tx.occurred_at.slice(0, 10)}</span>
              <span className="tx-category">{tx.category || '未分類'}</span>
              <span className="tx-note">{tx.note}</span>
              <span className={`tx-amount ${tx.type}`}>
                {tx.type === 'income' ? '+' : '-'}
                {formatAmount(tx.amount)}
              </span>
              <button className="delete" onClick={() => handleDeleteTransaction(tx.id)}>
                刪除
              </button>
            </li>
          ))}
          {transactions.length === 0 && <li className="empty">本月尚無交易紀錄</li>}
        </ul>
      </section>
    </div>
  )
}
