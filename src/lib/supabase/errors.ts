type SupabaseLikeError = {
  message: string
  code?: string
  hint?: string
  details?: string
}

const MIGRATE_V2_HINT =
  'Abra o SQL Editor do Supabase e execute o arquivo supabase_migrate_v2_reconcile.sql do projeto.'

export function formatSupabaseError(error: SupabaseLikeError): string {
  const extra = [error.code, error.hint, error.details].filter(Boolean).join(' — ')
  const message = extra ? `${error.message} (${extra})` : error.message

  const missingColumn =
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column .+ does not exist/i.test(message) ||
    /could not find the '.+' column/i.test(message) ||
    /schema cache/i.test(message)

  if (missingColumn) {
    return `O banco está desatualizado (coluna ausente no schema). ${MIGRATE_V2_HINT}`
  }

  const notNullViolation =
    error.code === '23502' ||
    /null value in column/i.test(message) ||
    /violates not-null constraint/i.test(message)

  if (notNullViolation) {
    if (/day_of_month/i.test(message)) {
      return `O banco ainda usa a coluna legada day_of_month. ${MIGRATE_V2_HINT}`
    }
    return `Campo obrigatório ausente no banco. ${MIGRATE_V2_HINT}`
  }

  return message
}

export type ActionResult =
  | { success: true }
  | { success: false; error: string }
