package com.insiderflow.auth;

import com.insiderflow.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;

class LoginRateLimiterTest {

    @Test
    void blocksBruteForcingOneAccount() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        String ip = "1.1.1.1";
        String email = "victim@example.com";
        // 10 failures allowed, 11th check should trip.
        for (int i = 0; i < 10; i++) {
            limiter.checkAllowed(ip, email);
            limiter.recordFailure(ip, email);
        }
        ApiException ex = assertThrows(ApiException.class, () -> limiter.checkAllowed(ip, email));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatus());
    }

    @Test
    void blocksCredentialStuffingAcrossAccountsFromOneIp() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        String ip = "2.2.2.2";
        // Spray 40 distinct accounts (each a fresh per-account bucket) — the per-IP cap must trip.
        assertThrows(ApiException.class, () -> {
            for (int i = 0; i < 60; i++) {
                limiter.checkAllowed(ip, "user" + i + "@example.com");
            }
        });
    }

    @Test
    void differentIpsAreIndependent() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        // One IP maxes out its per-account bucket; a different IP for the same email is unaffected.
        for (int i = 0; i < 10; i++) {
            limiter.checkAllowed("3.3.3.3", "a@example.com");
            limiter.recordFailure("3.3.3.3", "a@example.com");
        }
        assertThrows(ApiException.class, () -> limiter.checkAllowed("3.3.3.3", "a@example.com"));
        assertDoesNotThrow(() -> limiter.checkAllowed("4.4.4.4", "a@example.com"));
    }

    @Test
    void successClearsPerAccountFailures() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        String ip = "5.5.5.5";
        String email = "b@example.com";
        for (int i = 0; i < 9; i++) {
            limiter.checkAllowed(ip, email);
            limiter.recordFailure(ip, email);
        }
        limiter.recordSuccess(ip, email); // clears the per-account counter
        assertDoesNotThrow(() -> limiter.checkAllowed(ip, email));
    }
}
