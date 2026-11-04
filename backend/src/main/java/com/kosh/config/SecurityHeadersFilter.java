package com.kosh.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Enterprise HTTP Security and Rate Limiting Filter.
 * Protects MCP endpoints and API surfaces against denial-of-service, clickjacking,
 * MIME-confusion, and unauthorized burst exhaustion.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class SecurityHeadersFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_MINUTE = 120;
    private static final long WINDOW_MS = 60_000L;

    private static class RateWindow {
        final long windowStartMs;
        final AtomicInteger count;

        RateWindow(long windowStartMs) {
            this.windowStartMs = windowStartMs;
            this.count = new AtomicInteger(1);
        }
    }

    private final Map<String, RateWindow> rateLimitMap = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // 1. Set Security Headers
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("X-XSS-Protection", "1; mode=block");
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

        String path = request.getRequestURI();

        // Bypass rate limiting for preflight CORS requests
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // Apply rate limiting specifically on /mcp/** and /api/**
        if (path.startsWith("/mcp") || path.startsWith("/api")) {
            String clientIp = resolveClientIp(request);
            long now = System.currentTimeMillis();

            RateWindow window = rateLimitMap.compute(clientIp, (key, existing) -> {
                if (existing == null || (now - existing.windowStartMs) >= WINDOW_MS) {
                    return new RateWindow(now);
                } else {
                    existing.count.incrementAndGet();
                    return existing;
                }
            });

            int currentCount = window.count.get();
            long resetSeconds = Math.max(1, (WINDOW_MS - (now - window.windowStartMs)) / 1000);
            int remaining = Math.max(0, MAX_REQUESTS_PER_MINUTE - currentCount);

            response.setHeader("X-RateLimit-Limit", String.valueOf(MAX_REQUESTS_PER_MINUTE));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
            response.setHeader("X-RateLimit-Reset", String.valueOf(resetSeconds));

            if (currentCount > MAX_REQUESTS_PER_MINUTE) {
                response.setStatus(429);
                response.setContentType("application/json");
                response.getWriter().write(String.format(
                        "{\"error\":\"Rate limit exceeded\",\"limit\":%d,\"retryAfterSeconds\":%d}",
                        MAX_REQUESTS_PER_MINUTE, resetSeconds
                ));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
