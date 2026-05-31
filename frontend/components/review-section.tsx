'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StarRating } from '@/components/star-rating'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { MessageSquare, LogIn, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { Usuario, Resena } from '@/lib/types'

interface ReviewSectionProps {
  vehiculoId: string
}

export function ReviewSection({ vehiculoId }: ReviewSectionProps) {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [reviews, setReviews] = useState<Resena[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [newRating, setNewRating] = useState(0)
  const [newComment, setNewComment] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Verificar sesión activa
  useEffect(() => {
    api.getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false))
  }, [])

  // Cargar reseñas reales desde la API
  useEffect(() => {
    api.getResenasVehiculo(Number(vehiculoId))
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoadingReviews(false))
  }, [vehiculoId])

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.calificacion, 0) / reviews.length
    : 0

  const handleSubmitReview = async () => {
    if (!user || newRating === 0 || !newComment.trim()) return
    setSubmitting(true)
    try {
      const res = await api.crearResena(Number(vehiculoId), {
        calificacion: newRating,
        comentario: newComment.trim(),
      })
      // Añadir la nueva reseña a la lista localmente
      if (res.resena) setReviews(prev => [res.resena, ...prev])
      setSubmitSuccess(true)
      setNewRating(0)
      setNewComment('')
      setTimeout(() => {
        setShowForm(false)
        setSubmitSuccess(false)
      }, 2000)
    } catch {
      setNewRating(0)
      setNewComment('')
      setShowForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  // Redirige al login en vez de solo hacer console.log
  const handleLoginForReview = () => {
    const currentPath = `/vehiculo/${vehiculoId}`
    router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Reseñas
            </CardTitle>
            {reviews.length > 0 && !loadingReviews && (
              <div className="flex items-center gap-2 mt-2">
                <StarRating rating={Math.round(averageRating)} readonly size="sm" />
                <span className="text-sm text-muted-foreground">
                  {averageRating.toFixed(1)} ({reviews.length} reseña{reviews.length !== 1 ? 's' : ''})
                </span>
              </div>
            )}
          </div>
          
          {!showForm && (
            <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Escribir reseña
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Formulario de reseña */}
        {showForm && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            {checkingAuth ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : user ? (
              /* Usuario autenticado: puede escribir la reseña */
              <>
                {submitSuccess ? (
                  <div className="text-center py-4 text-green-600 font-medium">
                    ¡Reseña publicada con éxito!
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tu calificación</label>
                      <StarRating rating={newRating} onRatingChange={setNewRating} size="lg" />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="comment" className="text-sm font-medium">Tu comentario</label>
                      <Textarea
                        id="comment"
                        placeholder="Comparte tu experiencia con este vehículo..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" onClick={() => setShowForm(false)}>
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleSubmitReview}
                        disabled={newRating === 0 || !newComment.trim() || submitting}
                      >
                        {submitting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando...</>
                        ) : 'Publicar reseña'}
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : (
              /* No autenticado: invita a iniciar sesión */
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Inicia sesión para dejar una reseña
                </p>
                <Button onClick={handleLoginForReview} className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Iniciar sesión
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowForm(false)}
                  className="mt-2 block mx-auto"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Lista de reseñas */}
        {loadingReviews ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review, index) => {
              const nombre = review.usuario_nombre ?? 'Usuario'
              return (
                <div key={review.id}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="flex gap-4">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="font-medium">{nombre}</span>
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.calificacion} readonly size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(review.creado_en)}
                          </span>
                        </div>
                      </div>
                      {review.comentario && (
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                          {review.comentario}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aún no hay reseñas para este vehículo.</p>
            <p className="text-sm">¡Sé el primero en dejar una reseña!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
