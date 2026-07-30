package com.insiderflow.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Global per-IP request throttle over all {@code /api/**} endpoints (H4). A simple fixed-window
 * counter: at most {@value MAX_REQUESTS_PER_WINDOW} requests per IP per {@value WINDOW_SECONDS}s.
 * Protects the expensive analytics endpoints (clusters, digest, ticker enumeration) from a single
 * authenticated client hammering them. Runs before auth so it also shields the auth endpoints.
 *
 * In-memory / per-instance — for a multi-instance deployment move the counters to Redis.
 */
@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_WINDOW = 120; // ~2 req/s sustained per IP
    private static final long WINDOW_SECONDS = 60;

    private record Counter(long windowStart, java.util.concurrent.atomic.AtomicInteger count) {
    }

    private final Map<String, Counter> counters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String ip = clientIp(request);
        if (isRateLimited(ip)) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", String.valueOf(WINDOW_SECONDS));
            objectMapper.writeValue(response.getWriter(), Map.of(
                    "status", 429,
                    "error", "Too Many Requests",
                    "message", "Rate limit exceeded — slow down."));
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isRateLimited(String ip) {
        long now = Instant.now().getEpochSecond();
        long windowStart = now - (now % WINDOW_SECONDS);
        Counter c = counters.compute(ip, (key, existing) ->
                existing == null || existing.windowStart() != windowStart
                        ? new Counter(windowStart, new java.util.concurrent.atomic.AtomicInteger())
                        : existing);
        int n = c.count().incrementAndGet();
        // Opportunistic cleanup so the map doesn't grow unbounded.
        if (counters.size() > 5000) {
            counters.entrySet().removeIf(e -> e.getValue().windowStart() != windowStart);
        }
        return n > MAX_REQUESTS_PER_WINDOW;
    }

    /** Respects X-Forwarded-For (first hop) so the limit is per real client behind a proxy. */
    private String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
