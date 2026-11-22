import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-sm bg-white p-0 text-slate-900 ring-slate-300 sm:max-w-md"
      >
        <DialogHeader className="gap-1 px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold break-words text-slate-900">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
            className={cn("h-11 rounded-sm border-slate-500 px-5", FOCUS_RING_LIGHT)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn("h-11 rounded-sm bg-red-700 px-5 text-white hover:bg-red-800", FOCUS_RING_LIGHT)}
          >
            {busy ? "Eliminando..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmDialog
