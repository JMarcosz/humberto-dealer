'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2
} from 'lucide-react'

export default function ExcelPage() {
  const [exporting, setExporting]           = useState(false)
  const [importing, setImporting]           = useState(false)
  const [importErrors, setImportErrors]     = useState<string[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [lastAction, setLastAction]         = useState<'export' | 'import' | null>(null)

  const [confirmExport, setConfirmExport]   = useState(false)
  const [confirmImport, setConfirmImport]   = useState(false)
  const [pendingFile, setPendingFile]       = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!importing) return
    const interval = setInterval(async () => {
      try {
        const prog = await api.getProgresoImportacion()
        const pct = prog.total > 0 ? Math.round((prog.procesado / prog.total) * 100) : 50
        setImportProgress(pct)
        if (prog.terminado) {
          setImporting(false)
          setImportErrors(prog.errores)
          clearInterval(interval)
        }
      } catch {
        setImporting(false)
        clearInterval(interval)
      }
    }, 800)
    return () => clearInterval(interval)
  }, [importing])

  const handleExport = async () => {
    setConfirmExport(false)
    setExporting(true)
    setLastAction('export')
    try {
      const blob = await api.exportarExcel()
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href  = url
      link.download = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exportando:', err)
      alert('Error al exportar. Verifica que el backend está corriendo.')
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setConfirmImport(true)
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!pendingFile) return
    setConfirmImport(false)
    setImporting(true)
    setImportProgress(0)
    setLastAction('import')
    setImportErrors([])
    try {
      await api.importarExcel(pendingFile)
    } catch (err) {
      console.error('Error importando:', err)
      setImportErrors(['Error al enviar archivo. Verifica que es un .xlsx válido.'])
      setImporting(false)
    } finally {
      setPendingFile(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Excel</h1>
        <p className="text-muted-foreground">Importar y exportar inventario en formato Excel</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Exportar Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Descarga todos los vehículos del inventario en un archivo .xlsx que puedes abrir en Excel.
            </p>
            {lastAction === 'export' && !exporting && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Exportación completada
              </div>
            )}
            <Button onClick={() => setConfirmExport(true)} disabled={exporting} className="w-full gap-2">
              {exporting ? <><Loader2 className="h-4 w-4 animate-spin" />Exportando...</> :
                           <><FileSpreadsheet className="h-4 w-4" />Exportar a Excel</>}
            </Button>
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Importar Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Carga un archivo .xlsx para agregar vehículos como borradores. Luego puedes revisarlos y aprobarlos.
            </p>
            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importando...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}
            {lastAction === 'import' && !importing && importErrors.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Importación completada sin errores
              </div>
            )}
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileSelected}
                disabled={importing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button variant="outline" disabled={importing} className="w-full gap-2 pointer-events-none">
                {importing ? <><Loader2 className="h-4 w-4 animate-spin" />Importando...</> :
                             <><FileSpreadsheet className="h-4 w-4" />Seleccionar archivo .xlsx</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {importErrors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Errores de Importación ({importErrors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {importErrors.map((error, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Instrucciones</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>El archivo .xlsx puede ser el formato de inventario de Humberto (columnas MARCA, COLOR, AÑO, PRECIO) o el formato estándar con: <strong>modelo</strong>, <strong>año</strong>, <strong>vin</strong>, <strong>color</strong>, <strong>precio</strong>, <strong>combustible</strong>, <strong>transmisión</strong>.</p>
          <p>Los vehículos se importan como <strong>BORRADORES</strong>. Apruébalos en la sección Vehículos.</p>
        </CardContent>
      </Card>

      {/* Confirmación exportar */}
      <Dialog open={confirmExport} onOpenChange={setConfirmExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar inventario</DialogTitle>
            <DialogDescription>
              Se descargará un archivo Excel con todos los vehículos del inventario. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmExport(false)}>Cancelar</Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación importar */}
      <Dialog open={confirmImport} onOpenChange={setConfirmImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar inventario</DialogTitle>
            <DialogDescription>
              Se importarán los vehículos del archivo <strong>{pendingFile?.name}</strong> como borradores.
              Los vehículos que ya existan serán omitidos. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmImport(false); setPendingFile(null) }}>Cancelar</Button>
            <Button onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
