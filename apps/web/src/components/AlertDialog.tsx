'use client';

interface AlertDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttonLabel?: string;
  buttonClass?: string;
}

export default function AlertDialog({
  open,
  title,
  message,
  onClose,
  buttonLabel = 'OK',
  buttonClass = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700',
}: AlertDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className={buttonClass}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

