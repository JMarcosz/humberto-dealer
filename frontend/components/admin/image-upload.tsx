'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Upload, X, ImageIcon } from 'lucide-react'

interface ImageUploadProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
}

export function ImageUpload({ images, onImagesChange, maxImages = 10 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploading(true)
    
    // Simulate upload - in production, this would upload to your storage
    const newImages = acceptedFiles.slice(0, maxImages - images.length).map(file => 
      URL.createObjectURL(file)
    )
    
    setTimeout(() => {
      onImagesChange([...images, ...newImages])
      setUploading(false)
    }, 500)
  }, [images, onImagesChange, maxImages])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxFiles: maxImages - images.length,
    disabled: images.length >= maxImages || uploading
  })

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onImagesChange(newImages)
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
          isDragActive && "border-primary bg-primary/5",
          images.length >= maxImages && "opacity-50 cursor-not-allowed",
          !isDragActive && "border-border hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <Upload className={cn("h-10 w-10", isDragActive ? "text-primary" : "text-muted-foreground")} />
          {isDragActive ? (
            <p className="text-primary font-medium">Suelta las imágenes aquí...</p>
          ) : uploading ? (
            <p className="text-muted-foreground">Subiendo...</p>
          ) : (
            <>
              <p className="font-medium">Arrastra imágenes aquí o haz clic para seleccionar</p>
              <p className="text-sm text-muted-foreground">
                PNG, JPG o WEBP. Máximo {maxImages} imágenes.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-muted">
              <Image
                src={image}
                alt={`Imagen ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
              {index === 0 && (
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium bg-primary text-primary-foreground">
                  Principal
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span>No hay imágenes agregadas</span>
        </div>
      )}
    </div>
  )
}
