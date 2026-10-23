<?php
/**
 * VARNYXA PayYantra Diagnostic Logger
 *
 * Provides PCI-DSS compliant logging with automated redaction of
 * API keys, secrets, tokens, cards, and sensitive customer data.
 *
 * @package   VARNYXA_PayYantra_Gateway
 * @author    VARNYXA Haute Couture
 * @license   Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

class Varnyxa_PayYantra_Logger {

    /**
     * Logger context handle.
     */
    const CONTEXT_HANDLE = 'varnyxa-payyantra';

    /**
     * Sensitive keys that must be redacted from arrays/JSON before logging.
     *
     * @var array
     */
    protected static $sensitive_keys = array(
        'x-client-secret',
        'x-client-id',
        'client_secret',
        'client_id',
        'authorization',
        'token',
        'access_token',
        'orderAccessToken',
        'password',
        'card_number',
        'cardNumber',
        'cvv',
        'cvv2',
        'expiry',
        'webhook_secret',
    );

    /**
     * Check if debug logging is enabled in plugin settings.
     *
     * @return bool
     */
    public static function is_enabled() {
        $settings = get_option('woocommerce_varnyxa_payyantra_upi_settings', array());
        if (empty($settings)) {
            $settings = get_option('woocommerce_varnyxa_payyantra_card_settings', array());
        }
        return !empty($settings['debug_log']) && 'yes' === $settings['debug_log'];
    }

    /**
     * Redact sensitive values from data.
     *
     * @param mixed $data Data to sanitize.
     * @return mixed
     */
    public static function redact($data) {
        if (is_array($data)) {
            $clean = array();
            foreach ($data as $key => $value) {
                $lower_key = strtolower((string)$key);
                $is_sensitive = false;
                foreach (self::$sensitive_keys as $pattern) {
                    if (false !== strpos($lower_key, strtolower($pattern))) {
                        $is_sensitive = true;
                        break;
                    }
                }

                if ($is_sensitive) {
                    if (is_string($value) && strlen($value) > 8) {
                        $clean[$key] = substr($value, 0, 4) . '****' . substr($value, -4);
                    } else {
                        $clean[$key] = '********';
                    }
                } else {
                    $clean[$key] = self::redact($value);
                }
            }
            return $clean;
        }

        if (is_string($data)) {
            // Redact Bearer tokens
            $data = preg_replace('/(Bearer\s+)[A-Za-z0-9\-\._~\+\/]+=*/i', '$1[REDACTED_JWT]', $data);
            // Redact 13-19 digit card numbers
            $data = preg_replace('/\b(?:\d[ -]*?){13,19}\b/', '[REDACTED_CARD]', $data);
            return $data;
        }

        return $data;
    }

    /**
     * Write an info-level log entry.
     *
     * @param string $message Log message.
     * @param mixed  $context Context data to log.
     */
    public static function info($message, $context = null) {
        if (!self::is_enabled()) {
            return;
        }
        self::log('info', $message, $context);
    }

    /**
     * Write an error-level log entry (always logged regardless of debug toggle).
     *
     * @param string $message Error message.
     * @param mixed  $context Context data.
     */
    public static function error($message, $context = null) {
        self::log('error', $message, $context);
    }

    /**
     * Write a warning-level log entry.
     *
     * @param string $message Warning message.
     * @param mixed  $context Context data.
     */
    public static function warning($message, $context = null) {
        if (!self::is_enabled()) {
            return;
        }
        self::log('warning', $message, $context);
    }

    /**
     * Internal logging dispatcher using WooCommerce WC_Logger.
     *
     * @param string $level   Log level (info, warning, error).
     * @param string $message Log message.
     * @param mixed  $context Context data.
     */
    protected static function log($level, $message, $context = null) {
        if (!function_exists('wc_get_logger')) {
            return;
        }

        $logger = wc_get_logger();
        if (!$logger) {
            return;
        }

        $log_entry = '[VARNYXA PayYantra] ' . $message;
        if (null !== $context) {
            $sanitized_context = self::redact($context);
            if (is_array($sanitized_context) || is_object($sanitized_context)) {
                $log_entry .= ' | Context: ' . wp_json_encode($sanitized_context);
            } else {
                $log_entry .= ' | Context: ' . $sanitized_context;
            }
        }

        $logger->log($level, $log_entry, array('source' => self::CONTEXT_HANDLE));
    }
}
