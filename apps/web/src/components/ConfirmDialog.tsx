'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonClass?: string;
  cancelButtonClass?: string;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmButtonClass = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700',
  cancelButtonClass = 'px-4 py-2 border border-gray-300 rounded hover:bg-gray-50',
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="flex gap-4 justify-end">
          <button
            onClick={onCancel}
            className={cancelButtonClass}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={confirmButtonClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}



