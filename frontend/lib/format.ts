const TZ = 'America/Santo_Domingo'

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-DO', {
    timeZone: TZ,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('es-DO', {
    timeZone: TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
