'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmButtonClass?: string;
  cancelButtonClass?: string;
  loading?: boolean;
  loadingLabel?: string;
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
  loading = false,
  loadingLabel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const displayLabel = loading ? (loadingLabel || 'Processing...') : confirmLabel;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="flex gap-4 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className={`${cancelButtonClass} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`${confirmButtonClass} ${loading ? 'opacity-50 cursor-not-allowed' : ''} flex items-center gap-2`}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {displayLabel}
          </button>
        </div>
      </div>
    </div>
  );
}



