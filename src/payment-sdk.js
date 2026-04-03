(function (window) {
    'use strict';

    /**
     * @typedef {Object} PaymentCheckoutOptions
     * @property {string} orderId - 订单编号【唯一必填参数】
     * @property {string} orderApiUrl - 查询订单信息的后端接口地址,参数名必须是orderId。如：orderApiUrl?orderId=xxx
     * @property {string} qrApiUrl -二维码生成接口,也可以用前端生成
     * @property {string} address - 收款地址
     * @property {string} [apiBaseUrl] - api base url
     * @property {(data: PaymentResult) => void} callback - 支付成功回调
     * @property {() => void} onclose - 关闭/取消/过期回调
     */

    /**
     * @typedef {Object} PaymentResult
     * @property {string} orderId - 订单ID
     * @property {string} status - 订单状态（PAID/EXPIRED/CANCEL）
     */

    class PaymentCheckout {
        constructor(options) {
            this.options = {
                orderId: '',
                apiBaseUrl: '',
                address: '',
                orderApiUrl: '',
                qrApiUrl: '',
                callback: () => { },
                onclose: () => { },
                ...options
            };

            this.baseUrl = this.options.apiBaseUrl || window.location.origin;
            this.shadowHost = null;
            this.shadowRoot = null;
            this.iframe = null;
            this.overlay = null;
            this.pollingInterval = null;
            this.hasHandledStatus = false;
            this.isClosing = false;  // 新增：标记是否正在关闭
            this.handleMessage = this.handleMessage.bind(this);
            this.close = this.close.bind(this);
            this.handleEscKey = this.handleEscKey.bind(this);
        }

        supportsShadowDOM() {
            return !!document.createElement('div').attachShadow;
        }

        open() {
            if (!this.options.orderId) {
                throw new Error('[PaymentCheckout] 缺少 orderId');
            }

            // 清理之前的实例但不调用 onclose
            this.cleanupPreviousInstance();

            if (this.supportsShadowDOM()) {
                this.openWithShadowDOM();
            } else {
                throw new Error('The current environment does not support Shadow DOM, thus unable to open the payment pop-up window');
            }
        }

        // 新增：清理之前的实例但不触发回调
        cleanupPreviousInstance() {
            if (this.isClosing) return;
            this.isClosing = true;         

            if (this.shadowHost) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
                try {
                    if (this.shadowHost.parentNode === document.body)
                        document.body.removeChild(this.shadowHost);
                } catch (e) {
                    console.log('移除shadowHost时出错:', e);
                }
                this.shadowHost = null;
                this.shadowRoot = null;
                document.removeEventListener('keydown', this.handleEscKey);
            }

            if (this.overlay) {
                window.removeEventListener('message', this.handleMessage);
                try {
                    if (this.overlay.parentNode === document.body)
                        document.body.removeChild(this.overlay);
                } catch (e) {
                    console.log('移除overlay时出错:', e);
                }
                this.overlay = null;
                this.iframe = null;
                document.removeEventListener('keydown', this.handleEscKey);
            }

            this.hasHandledStatus = false;
            this.isClosing = false;
           
        }

        openWithShadowDOM() {
            this.shadowHost = document.createElement('div');
            this.shadowHost.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        overflow: auto;
      `;
            document.body.appendChild(this.shadowHost);

            this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });

            const style = document.createElement('style');
            style.textContent = `
        .checkout-container {
          width: 90%;
          max-width: 400px;
          background: #fff;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          margin: 20px 0;
        }
        .loading {
          text-align: center;
          padding: 20px;
          color: #6b7280;
          background: #fff;
          border-radius: 12px;
          width: 90%;
          max-width: 400px;
        }
        .error {
          color: #ef4444;
          padding: 20px;
          background: #fff;
          border-radius: 12px;
          width: 90%;
          max-width: 400px;
          text-align: center;
        }
        .checkout-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .back-link {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
        }
        .order-status {
          font-size: 14px;
          font-weight: 500;
        }
        .checkout-title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 20px;
          color: #1f2937;
        }
        .amount-panel {
          margin-bottom: 20px;
        }
        .amount-label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 8px;
        }
        .amount-value {
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 8px;
        }
        .notice {
          font-size: 12px;
          color: #6b7280;
        }
        .address-panel {
          margin-bottom: 20px;
        }
        .address-label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 8px;
        }
        .address-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 12px;
        }
        .address-code {
          flex: 1;
          font-size: 12px;
          word-break: break-all;
          color: #1f2937;
        }
        .icon-btn {
          padding: 4px 8px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: #f9fafb;
          cursor: pointer;
          font-size: 12px;
        }
        .qr-wrap {
          text-align: center;
          margin-bottom: 12px;
        }
        .qr-toggle {
          width: 100%;
          padding: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: #f9fafb;
          cursor: pointer;
          font-size: 12px;
          margin-bottom: 12px;
        }
        .expired-text {
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .expired-text.danger {
          color: #ef4444;
        }
        .action-row {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .action-row.single {
          justify-content: center;
        }
        .btn-primary {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          background: #3b82f6;
          color: #fff;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-secondary {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          background: #e5e7eb;
          color: #374151;
          cursor: pointer;
          font-size: 14px;
        }
        .status-tip {
          text-align: center;
          padding: 30px 10px;
          font-size: 15px;
          color: #6b7280;
        }
      `;
            this.shadowRoot.appendChild(style);
            const loadingEl = document.createElement('div');
            loadingEl.className = 'loading';
            loadingEl.textContent = 'Loading order information...';
            this.shadowRoot.appendChild(loadingEl);

            this.fetchOrderData().then((order) => {
                if (this.shadowRoot && this.shadowRoot.contains(loadingEl)) {
                    this.shadowRoot.removeChild(loadingEl);
                }
                this.renderCheckoutContent(order);
            }).catch((error) => {
                try {
                    if (this.shadowRoot && loadingEl.parentNode === this.shadowRoot) {
                        this.shadowRoot.removeChild(loadingEl);
                    }
                } catch (e) { }

                if (this.shadowRoot) {
                    const errorEl = document.createElement('div');
                    errorEl.className = 'error';
                    errorEl.textContent = `Failed：${error.message}`;
                    this.shadowRoot.appendChild(errorEl);
                }
            });

            document.addEventListener('keydown', this.handleEscKey);
        }
        //只更新状态
        async fetchOrderData() {
            const url = new URL(this.options.orderApiUrl, this.baseUrl);
            url.searchParams.set('orderId', this.options.orderId);
            try {
                const resp = await fetch(url.toString(), { cache: 'no-store' });
                const payload = await resp.json();

                if (!payload.success || !payload.data) {
                    throw new Error(payload.msg || 'Failed to obtain order information');
                }
                const order = payload.data.orders?.[0];
                if (!order) {
                    throw new Error('Order not found');
                }
                return order;
            }
            catch (error) {
                console.error('Error fetching order data:', error);
                throw error;
            }
        }

        renderCheckoutContent(order) {
            if (!this.shadowRoot) return;

            const container = document.createElement('div');
            container.className = 'checkout-container';

            const formatCountdown = (ms) => {
                if (ms <= 0) return '00:00:00';
                const s = Math.floor(ms / 1000);
                const h = String(Math.floor(s / 3600)).padStart(2, '0');
                const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
                const sec = String(s % 60).padStart(2, '0');
                return `${h}:${m}:${sec}`;
            };

            const statusText = (s) => {
                if (s === 'INIT') return 'INIT';
                if (s === 'PENDING') return 'PENDING';
                if (s === 'PAID') return 'PAID';
                if (s === 'EXPIRED') return 'EXPIRED';
                return s;
            };

            const statusColor = (s) => {
                if (s === 'PAID') return '#10b981';
                if (s === 'EXPIRED') return '#ef4444';
                if (s === 'PENDING') return '#f59e0b';
                return '#6b7280';
            };

            const address = this.options.address;
            const hasAddress = !!address;
            const isExpired = order.expired <= Date.now();
            const qrUrl = hasAddress
                ? `${this.options.qrApiUrl}?text=${encodeURIComponent(address)}`
                : '';

            let showQr = true;
            const isOrderExpired = order.status === 'EXPIRED';

            container.innerHTML = `
        <div class="checkout-header">
          <button type="button" class="back-link" id="backBtn">← 返回</button>
          <span class="order-status" style="color: ${statusColor(order.status)}">
            ${statusText(order.status)}
          </span>
        </div>
        <h1 class="checkout-title">Checkout</h1>

        <div class="amount-panel {
         
          <p class="amount-value">${parseFloat(order.qty) || 0} ${order.coin || ''}</p>
          <p class="notice"><b>Chain:</b> ${order.chain || ''} | <b>Order ID:</b> ${order.id || ''}</p>
        </div>

        <div class="address-panel">
          ${hasAddress ? `
            <p class="address-label">Address</p>
            <div class="address-row">
              <code class="address-code">${address}</code>
              <button type="button" class="icon-btn" id="copyBtn">Copy</button>
            </div>
            <div class="qr-wrap" id="qrWrap">
              <img src="${qrUrl}" style="width:200px;height:200px" alt="qr">
            </div>
            <button class="qr-toggle" id="qrToggleBtn">Hide Qr Code</button>

            <p class="expired-text ${isExpired ? 'danger' : ''}">
              剩余时间：<span id="countdown">${formatCountdown(order.expired - Date.now())}</span>
            </p>
          ` : `
            <div class="status-tip">
              ${order.status === 'PAID' ? '✅ PAID' :
                    order.status === 'EXPIRED' ? '⏳ EXPIRED' :
                        'ℹ️ No Payment Address Available'}
              <br>
              <small style="font-size:12px;color:#999">
                ${order.status === 'PAID' ? 'Please return to the merchant to view the result' :
                    order.status === 'EXPIRED' ? 'Please recreate the order' :
                        'Please refresh the status'}
              </small>
            </div>
          `}
        </div>

        <div class="action-row ${isOrderExpired ? 'single' : ''}">
          ${!isOrderExpired ? `
            <button type="button" class="btn-primary" id="refreshBtn">刷新状态</button>
          ` : ''}
          <button type="button" class="btn-secondary" id="closeBtn">返回商户</button>
        </div>
      `;

            this.shadowRoot.appendChild(container);

            container.querySelector('#backBtn')?.addEventListener('click', this.close);
            container.querySelector('#closeBtn')?.addEventListener('click', this.close);

            if (!isOrderExpired) {
                container.querySelector('#refreshBtn')?.addEventListener('click', () => {
                    this.fetchOrderData().then(newOrder => {
                        const el = container.querySelector('.order-status');
                        el.textContent = statusText(newOrder.status);
                        el.style.color = statusColor(newOrder.status);
                        this.checkOrderStatus(newOrder);
                    });
                });
            }

            container.querySelector('#copyBtn')?.addEventListener('click', () => {
                navigator.clipboard.writeText(address).then(() => {
                    const btn = container.querySelector('#copyBtn');
                    btn.textContent = 'Copied';
                    setTimeout(() => btn.textContent = 'Copy', 1500);
                });
            });

            const qrToggle = container.querySelector('#qrToggleBtn');
            const qrWrap = container.querySelector('#qrWrap');
            if (qrToggle && qrWrap) {
                qrToggle.addEventListener('click', () => {
                    showQr = !showQr;
                    qrWrap.style.display = showQr ? 'block' : 'none';
                    qrToggle.textContent = showQr ? 'Hide QR code' : 'Display QR code';
                });
            }

            if (hasAddress && !isOrderExpired) {
                const countdownEl = container.querySelector('#countdown');
                if (countdownEl) {
                    const timer = setInterval(() => {
                        if (!this.shadowRoot) { clearInterval(timer); return; }
                        const remain = order.expired - Date.now();
                        countdownEl.textContent = formatCountdown(remain);

                        // 时间到 0 → 自动关闭弹窗
                        if (remain <= 0) {
                            console.log('倒计时结束，开始关闭流程');
                            clearInterval(timer);
                            this.checkOrderStatus({ ...order, status: 'EXPIRED' });
                            setTimeout(() => {
                                console.log('倒计时结束，执行最终关闭');
                                this.close();
                            }, 800);
                        }
                    }, 1000);
                }
            }

            if (!isOrderExpired) {
                this.pollingInterval = setInterval(() => {
                    if (!this.shadowRoot) { clearInterval(this.pollingInterval); return; }
                    this.fetchOrderData().then(o => this.checkOrderStatus(o));
                }, 3000);
            }

            this.checkOrderStatus(order);
        }

        checkOrderStatus(order) {
            if (this.hasHandledStatus) return;

            if (order.status === 'PAID') {
                this.hasHandledStatus = true;
                this.options.callback({
                    orderId: order.orderId,
                    status: 'PAID'
                });
                setTimeout(() => this.close(), 2000);
            }

            if (order.status === 'EXPIRED') {
                this.hasHandledStatus = true;
                this.options.onclose();
            }
        }

        handleMessage(event) {
            if (event.origin !== this.baseUrl && !event.origin.startsWith('http://localhost')) return;
            if (this.hasHandledStatus) return;

            const { type } = event.data || {};
            if (type === 'PAYMENT_SUCCESS') {
                this.hasHandledStatus = true;
                this.options.callback({ orderId: this.options.orderId, status: 'PAID' });
                this.close();
            }
            if (type === 'PAYMENT_CANCEL' || type === 'PAYMENT_EXPIRED') {
                this.hasHandledStatus = true;
                this.options.onclose();
                this.close();
            }
        }

        handleEscKey(e) {
            if (e.key === 'Escape') this.close();
        }

        close() {
            if (this.isClosing) return;  // 防止重复关闭
            this.isClosing = true;
            // 如果没有处理过状态，则调用 onclose
            if (!this.hasHandledStatus) {
                console.log("sdk closed by user");
                this.options.onclose();
            }

            this.hasHandledStatus = true;

            if (this.shadowHost) {
                clearInterval(this.pollingInterval);
                try {
                    if (this.shadowHost.parentNode === document.body)
                        document.body.removeChild(this.shadowHost);
                } catch { }
                this.shadowHost = null;
                this.shadowRoot = null;
                document.removeEventListener('keydown', this.handleEscKey);
            }

            if (this.overlay) {
                window.removeEventListener('message', this.handleMessage);
                try {
                    if (this.overlay.parentNode === document.body)
                        document.body.removeChild(this.overlay);
                } catch { }
                this.overlay = null;
                this.iframe = null;
                document.removeEventListener('keydown', this.handleEscKey);
            }
        }
    }

    window.PaymentCheckout = PaymentCheckout;

})(window);

// 在最后，判断环境并导出
if (typeof exports === 'object' && typeof module === 'object') {
    // CommonJS 环境 (Node.js, 被 Webpack 等打包时)
    module.exports = PaymentCheckout;
} else if (typeof define === 'function' && define.amd) {
    // AMD 环境 (Require.js)
    define([], () => PaymentCheckout);
} else if (typeof exports === 'object') {
    // CommonJS 导出
    exports['PaymentCheckout'] = PaymentCheckout;
} else {
    // 浏览器全局变量
    window.PaymentCheckout = PaymentCheckout;
}