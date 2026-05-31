import { getFlagCode } from '../utils/flags'

export function Flag({ name }: { name: string | null | undefined }) {
  const code = getFlagCode(name)
  if (!code) return null
  return <span className={`fi fi-${code} rounded-sm shrink-0`} />
}
