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

/**
 * Global confirm dialog replacement
 * @param message The main message to display
 * @param title Optional title
 * @param confirmText Text for the confirm button ("Yes", "Confirm", "Delete")
 * @param cancelText Text for the cancel button
 * @param confirmClass DaisyUI button color class (e.g. "btn-error" for destructive actions)
 * @returns Promise<boolean> that resolves to true if confirmed, false if cancelled.
 */
export const confirmDialog = (
    message: string, 
    title = 'Please Confirm', 
    confirmText = 'Yes', 
    cancelText = 'Cancel',
    confirmClass = 'btn-primary'
): Promise<boolean> => {
    return new Promise((resolve) => {
        confirmState.set({
            isOpen: true,
            title,
            message,
            confirmText,
            cancelText,
            confirmClass,
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
