/**
 * VARNYXA PayYantra Real-time Payment Polling Script
 */
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        var wrap = document.getElementById('varnyxa-upi-checkout-wrap');
        if (!wrap) {
            return;
        }

        var orderId   = wrap.getAttribute('data-order-id');
        var orderKey  = wrap.getAttribute('data-order-key');
        var pollUrl   = wrap.getAttribute('data-poll-url');
        var nonce     = wrap.getAttribute('data-nonce');
        var statusTxt = document.getElementById('poll-status-text');
        var manualBtn = document.getElementById('varnyxa-manual-check-btn');
        var timerEl   = document.getElementById('varnyxa-countdown-timer');

        var isChecking = false;
        var pollInterval = null;
        var remainingSeconds = 15 * 60; // 15 minutes default

        // 1. Countdown Timer
        function updateTimer() {
            if (remainingSeconds <= 0) {
                if (timerEl) timerEl.textContent = '00:00';
                if (statusTxt) statusTxt.textContent = 'Session Expired. Please retry checkout.';
                clearInterval(pollInterval);
                return;
            }
            var mins = Math.floor(remainingSeconds / 60);
            var secs = remainingSeconds % 60;
            if (timerEl) {
                timerEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
            }
            remainingSeconds--;
        }
        setInterval(updateTimer, 1000);

        // 2. Poll Status Request
        function checkStatus(isManual) {
            if (isChecking) return;
            isChecking = true;

            if (isManual && manualBtn) {
                var spinner = manualBtn.querySelector('.btn-spinner');
                if (spinner) spinner.style.display = 'inline-block';
                manualBtn.disabled = true;
            }

            var formData = new FormData();
            formData.append('action', 'varnyxa_payyantra_poll_status');
            formData.append('order_id', orderId);
            formData.append('order_key', orderKey);
            formData.append('_ajax_nonce', nonce);

            fetch(pollUrl, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            })
            .then(function(res) { return res.json(); })
            .then(function(res) {
                isChecking = false;
                if (isManual && manualBtn) {
                    var spinner = manualBtn.querySelector('.btn-spinner');
                    if (spinner) spinner.style.display = 'none';
                    manualBtn.disabled = false;
                }

                if (res && res.success && res.data) {
                    var st = res.data.status;
                    if (st === 'paid') {
                        if (statusTxt) statusTxt.innerHTML = '<strong>Payment Confirmed!</strong> Redirecting to receipt...';
                        clearInterval(pollInterval);
                        setTimeout(function() {
                            window.location.href = res.data.redirect_url;
                        }, 1200);
                    } else if (st === 'failed') {
                        if (statusTxt) statusTxt.textContent = 'Payment was declined or failed. Please retry.';
                        clearInterval(pollInterval);
                    }
                }
            })
            .catch(function(err) {
                isChecking = false;
                if (isManual && manualBtn) {
                    var spinner = manualBtn.querySelector('.btn-spinner');
                    if (spinner) spinner.style.display = 'none';
                    manualBtn.disabled = false;
                }
            });
        }

        // 3. Initiate Automated Interval (Every 3.5 seconds)
        pollInterval = setInterval(function() {
            checkStatus(false);
        }, 3500);

        // 4. Manual Check Button Click
        if (manualBtn) {
            manualBtn.addEventListener('click', function(e) {
                e.preventDefault();
                checkStatus(true);
            });
        }
    });
})();
