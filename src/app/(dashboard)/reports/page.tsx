import { getTransactions } from '@/actions/transactions'
import { getDashboardBalances } from '@/actions/transactions'
import { ReportsClient } from '@/components/ReportsClient'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year || String(now.getFullYear()))
  const month = parseInt(params.month || String(now.getMonth() + 1))

  const [transactions, { cards }] = await Promise.all([
    getTransactions(year, month),
    getDashboardBalances(),
  ])

  return <ReportsClient transactions={transactions} cards={cards} year={year} month={month} />
}
