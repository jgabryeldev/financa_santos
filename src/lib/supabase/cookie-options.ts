/** Duração longa para o refresh token / sessão (≈ 400 dias). */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 400

export const authCookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: AUTH_COOKIE_MAX_AGE,
}
