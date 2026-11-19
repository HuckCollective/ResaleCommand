import { atom } from 'nanostores';

export interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    confirmClass?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const confirmState = atom<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmClass: 'btn-primary',
    onConfirm: () => {},
    onCancel: () => {}
});

export interface ConfirmDialogOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmClass?: string;
    danger?: boolean;
}

/**
 * Global confirm dialog replacement.
 * Supports both positional arguments (`confirmDialog(message, title, ...)`)
 * and an options object (`confirmDialog({ title, message, confirmText, cancelText, danger })`).
 * @returns Promise<boolean> that resolves to true if confirmed, false if cancelled.
 */
export const confirmDialog = (
    messageOrOptions: string | ConfirmDialogOptions,
    title = 'Please Confirm',
    confirmText = 'Yes',
    cancelText = 'Cancel',
    confirmClass = 'btn-primary'
): Promise<boolean> => {
    const opts: ConfirmDialogOptions =
        typeof messageOrOptions === 'string'
            ? { message: messageOrOptions, title, confirmText, cancelText, confirmClass }
            : messageOrOptions || { message: '' };

    const resolvedTitle = opts.title || title;
    const resolvedMessage = String(opts.message || '');
    const resolvedConfirmText = opts.confirmText || confirmText;
    const resolvedCancelText = opts.cancelText || cancelText;
    const resolvedConfirmClass =
        opts.confirmClass || (opts.danger ? 'btn-error' : confirmClass);

    return new Promise((resolve) => {
        confirmState.set({
            isOpen: true,
            title: resolvedTitle,
            message: resolvedMessage,
            confirmText: resolvedConfirmText,
            cancelText: resolvedCancelText,
            confirmClass: resolvedConfirmClass,
            onConfirm: () => {
                confirmState.set({ ...confirmState.get(), isOpen: false });
                resolve(true);
            },
            onCancel: () => {
                confirmState.set({ ...confirmState.get(), isOpen: false });
                resolve(false);
            }
        });
    });
};

export const askConfirm = confirmDialog;
