type SupabaseLikeError = {
  message: string
  code?: string
  hint?: string
  details?: string
}

export function formatSupabaseError(error: SupabaseLikeError): string {
  const extra = [error.code, error.hint, error.details].filter(Boolean).join(' — ')
  const message = extra ? `${error.message} (${extra})` : error.message

  if (/column .+ does not exist/i.test(message) || error.code === '42703') {
    return `${message}. Execute o script supabase_migrate.sql no SQL Editor do Supabase.`
  }

  return message
}

export type ActionResult =
  | { success: true }
  | { success: false; error: string }
