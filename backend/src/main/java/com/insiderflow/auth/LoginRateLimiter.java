package com.insiderflow.auth;

import com.insiderflow.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-memory sliding-window rate limiter for auth endpoints. Two independent caps:
 * <ul>
 *   <li>per (IP + email): {@value MAX_FAILURES_PER_ACCOUNT} — blocks brute-forcing one account;</li>
 *   <li>per IP across all accounts: {@value MAX_ATTEMPTS_PER_IP} — blocks credential stuffing and
 *       mass registration from a single IP (counts every attempt, success or fail).</li>
 * </ul>
 * Good enough for a single-instance deployment. Behind a load balancer / multiple instances,
 * move this to a shared store (e.g. Redis) so the limits are global.
 */
@Component
public class LoginRateLimiter {

    private static final int MAX_FAILURES_PER_ACCOUNT = 10;
    private static final int MAX_ATTEMPTS_PER_IP = 40;
    private static final Duration WINDOW = Duration.ofMinutes(10);

    private record Window(Instant start, AtomicInteger count) {
    }

    /** keyed by "ip|email" — failed logins/registers for one account */
    private final Map<String, Window> perAccount = new ConcurrentHashMap<>();
    /** keyed by ip — all attempts from one IP */
    private final Map<String, Window> perIp = new ConcurrentHashMap<>();

    /** Call at the START of every auth attempt. Throws 429 when either cap is exceeded. */
    public void checkAllowed(String ip, String email) {
        cleanup();
        Window ipWindow = perIp.get(nz(ip));
        if (ipWindow != null && ipWindow.count().get() >= MAX_ATTEMPTS_PER_IP && !expired(ipWindow)) {
            throw tooMany();
        }
        Window acctWindow = perAccount.get(key(ip, email));
        if (acctWindow != null && acctWindow.count().get() >= MAX_FAILURES_PER_ACCOUNT && !expired(acctWindow)) {
            throw tooMany();
        }
        // Count this attempt against the per-IP cap immediately (successes included).
        bump(perIp, nz(ip));
    }

    /** Call when an auth attempt FAILS (wrong password / duplicate email). */
    public void recordFailure(String ip, String email) {
        bump(perAccount, key(ip, email));
    }

    /** Call on success — clears the per-account failure counter (per-IP cap intentionally remains). */
    public void recordSuccess(String ip, String email) {
        perAccount.remove(key(ip, email));
    }

    private void bump(Map<String, Window> map, String k) {
        Window w = map.compute(k, (unused, existing) ->
                existing == null || expired(existing)
                        ? new Window(Instant.now(), new AtomicInteger())
                        : existing);
        w.count().incrementAndGet();
    }

    private ApiException tooMany() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many attempts — try again in a few minutes");
    }

    private boolean expired(Window w) {
        return w.start().isBefore(Instant.now().minus(WINDOW));
    }

    private String key(String ip, String email) {
        return nz(ip) + "|" + (email == null ? "?" : email.toLowerCase());
    }

    private String nz(String s) {
        return s == null ? "?" : s;
    }

    private void cleanup() {
        purge(perAccount);
        purge(perIp);
    }

    private void purge(Map<String, Window> map) {
        if (map.size() < 2000) {
            return;
        }
        Iterator<Map.Entry<String, Window>> it = map.entrySet().iterator();
        while (it.hasNext()) {
            if (expired(it.next().getValue())) {
                it.remove();
            }
        }
    }
}
