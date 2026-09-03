import { atom } from 'nanostores';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number; // ms, if 0 or undefined, stays until closed or replaced
    progress?: number; // 0-100, if present, shows progress bar
}

export const toasts = atom<Toast[]>([]);

export const addToast = (
    toastOrMessage: Omit<Toast, 'id'> | string, 
    type: ToastType = 'info', 
    customDuration?: number
) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    let toast: Omit<Toast, 'id'>;
    if (typeof toastOrMessage === 'string') {
        toast = {
            message: toastOrMessage,
            type: type || 'info',
            duration: customDuration
        };
    } else {
        toast = toastOrMessage || { message: '', type: 'info' };
    }

    // De-duplicate: If an identical toast is already visible, don't stack duplicates
    const current = toasts.get();
    const existing = current.find(t => t.message === toast.message);
    if (existing) {
        return existing.id;
    }

    // Set default duration if not provided
    let duration = toast.duration;
    if (duration === undefined) {
        switch (toast.type) {
            case 'success':
            case 'info':
                duration = 3000;
                break;
            case 'warning':
            case 'error':
                duration = 5000;
                break;
            case 'loading':
                duration = 0; // Loading toasts don't auto-dismiss by default
                break;
            default:
                duration = 3000;
        }
    }
    
    const newToast = { ...toast, id, duration };
    toasts.set([...toasts.get(), newToast]);

    if (duration && duration > 0) {
        setTimeout(() => removeToast(id), duration);
    }
    return id;
};

export const updateToast = (id: string, updates: Partial<Toast>) => {
    const current = toasts.get();
    const idx = current.findIndex(t => t.id === id);
    if (idx !== -1) {
        const updated = [...current];
        updated[idx] = { ...updated[idx], ...updates };
        toasts.set(updated);
    }
};

export const removeToast = (id: string) => {
    toasts.set(toasts.get().filter(t => t.id !== id));
};
