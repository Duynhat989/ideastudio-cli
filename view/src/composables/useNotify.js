import { reactive } from 'vue';

const state = reactive({
  open: false,
  mode: 'alert',
  title: '',
  message: '',
  variant: 'default',
  confirmText: 'OK',
  cancelText: 'Hủy',
  showCancel: false,
  /** @type {null | ((value?: boolean) => void)} */
  resolve: null,
});

function submit(value) {
  const r = state.resolve;
  const mode = state.mode;
  state.open = false;
  state.resolve = null;
  if (!r) return;
  if (mode === 'confirm') r(!!value);
  else r();
}

/**
 * @param {string | { title?: string, message: string, variant?: 'default'|'success'|'error'|'warning', confirmText?: string }} options
 */
function alert(options) {
  const o = typeof options === 'string' ? { message: options } : options || {};
  return new Promise((resolve) => {
    state.mode = 'alert';
    state.title = o.title || 'Thông báo';
    state.message = o.message || '';
    state.variant = o.variant || 'default';
    state.confirmText = o.confirmText || 'OK';
    state.showCancel = false;
    state.resolve = resolve;
    state.open = true;
  });
}

/**
 * @param {{ title?: string, message: string, variant?: string, confirmText?: string, cancelText?: string }} options
 * @returns {Promise<boolean>}
 */
function confirm(options) {
  const o = options || {};
  return new Promise((resolve) => {
    state.mode = 'confirm';
    state.title = o.title || 'Xác nhận';
    state.message = o.message || '';
    state.variant = o.variant || 'warning';
    state.confirmText = o.confirmText || 'Đồng ý';
    state.cancelText = o.cancelText || 'Hủy';
    state.showCancel = true;
    state.resolve = resolve;
    state.open = true;
  });
}

/** Đóng bằng backdrop: confirm → Hủy, alert → đóng như OK */
function dismiss() {
  if (!state.open) return;
  submit(state.mode === 'confirm' ? false : true);
}

export const notify = {
  state,
  alert,
  confirm,
  submit,
  dismiss,
};

export function useNotify() {
  return notify;
}
