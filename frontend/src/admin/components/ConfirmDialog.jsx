import React from 'react';

export const ConfirmDialog = ({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <h3 className="admin-modal-title">{title}</h3>
        <p className="admin-modal-body">{message}</p>
        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`admin-btn admin-btn-sm ${danger ? 'admin-btn-danger' : 'admin-btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
