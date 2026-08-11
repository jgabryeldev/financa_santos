import { getTransactions } from '@/actions/transactions'
import { ReportsClient } from '@/components/ReportsClient'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year || String(now.getFullYear()), 10)
  const month = parseInt(params.month || String(now.getMonth() + 1), 10)

  const transactions = await getTransactions(year, month)

  return <ReportsClient transactions={transactions} year={year} month={month} />
}
