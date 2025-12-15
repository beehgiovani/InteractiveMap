import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

interface ManusDialogProps {
  title?: string;
  logo?: string;
  open?: boolean;
  onLogin: () => void;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export function ManusDialog({
  title,
  logo,
  open = false,
  onLogin,
  onOpenChange,
  onClose,
}: ManusDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open);

  useEffect(() => {
    // Only update internal state if we're not controlled
    if (onOpenChange === undefined && open !== internalOpen) {
      setInternalOpen(open);
    }
  }, [open, onOpenChange, internalOpen]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      onClose?.();
    }
  };

  return (
    <Dialog
      open={onOpenChange ? open : internalOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="p-0 gap-0 border-none bg-transparent shadow-none w-full max-w-sm">
        <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Draggable Handle Header */}
            <div className="dialog-handle cursor-move p-6 pb-2 flex flex-col items-center gap-4 pt-8 group">
            {logo ? (
                <div className="w-20 h-20 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500">
                <img src={logo} alt="Dialog graphic" className="w-12 h-12 rounded-lg object-contain" />
                </div>
            ) : null}

            {/* Title and subtitle */}
            {title ? (
                <div className="text-center space-y-1">
                    <DialogTitle className="text-2xl font-bold text-white tracking-tight drop-shadow-md">
                    {title}
                    </DialogTitle>
                    <DialogDescription className="text-blue-200/70 font-medium">
                        Acesso Restrito ao Sistema
                    </DialogDescription>
                </div>
            ) : null}
            </div>

            <div className="px-8 pb-8 pt-2">
                 <div className="text-center mb-6">
                    <p className="text-sm text-gray-400 leading-relaxed">
                        Faça login para acessar o painel de controle e gerenciar os lotes do Jardim Acapulco.
                    </p>
                 </div>

                <DialogFooter className="sm:justify-center">
                    {/* Login button */}
                    <Button
                        onClick={onLogin}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-md font-bold tracking-wide shadow-lg shadow-blue-900/20 hover:shadow-blue-600/40 transition-all duration-300"
                    >
                        Entrar na Plataforma
                    </Button>
                </DialogFooter>
                 <div className="mt-6 flex justify-center items-center gap-2 opacity-50">
                    <div className="h-1 w-1 bg-white rounded-full"></div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-mono">Secure Access v2.0</span>
                    <div className="h-1 w-1 bg-white rounded-full"></div>
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
