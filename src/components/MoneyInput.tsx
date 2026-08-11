'use client'

import { Input } from '@/components/ui/input'
import {
  centsToNumber,
  digitsToCents,
  formatMoneyFromCents,
  numberToCents,
} from '@/lib/money'
import { cn } from '@/lib/utils'

type Props = {
  value: number
  onChange: (amount: number) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  id?: string
  'aria-label'?: string
}

/**
 * Input monetário: usuário só digita números; exibe pt-BR ao vivo (4.540,00).
 * `value` / `onChange` usam number em reais (ex.: 4540.5).
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = '0,00',
  className,
  autoFocus,
  id,
  'aria-label': ariaLabel,
}: Props) {
  const cents = numberToCents(value)
  const display = cents > 0 ? formatMoneyFromCents(cents) : ''

  function handleChange(raw: string) {
    const nextCents = digitsToCents(raw)
    onChange(centsToNumber(nextCents))
  }

  return (
    <Input
      id={id}
      aria-label={ariaLabel ?? 'Valor em reais'}
      value={display}
      onChange={(e) => handleChange(e.target.value)}
      onPaste={(e) => {
        e.preventDefault()
        handleChange(e.clipboardData.getData('text'))
      }}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={cn(className)}
    />
  )
}
