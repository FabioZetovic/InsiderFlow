package com.insiderflow.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(JwtService.class);

    public JwtService(@Value("${insiderflow.jwt.secret:}") String secret,
                      @Value("${insiderflow.jwt.expiration-ms}") long expirationMs) {
        if (secret == null || secret.isBlank()) {
            // No configured secret: generate a random one per process. Sessions won't survive
            // a backend restart, but nobody can forge tokens with a known default.
            byte[] random = new byte[64];
            new java.security.SecureRandom().nextBytes(random);
            this.key = Keys.hmacShaKeyFor(random);
            log.warn("JWT_SECRET not set — generated a random signing key; sessions will not survive restarts. "
                    + "Set JWT_SECRET for persistent sessions.");
        } else {
            this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        }
        this.expirationMs = expirationMs;
    }

    public String generateToken(User user) {
        Date now = new Date();
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("username", user.getUsername())
                .claim("userId", user.getId())
                .claim("tv", user.getTokenVersion()) // token version for revocation
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    /** Verified token claims (subject = email, "tv" = token version), or null when invalid/expired. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            return null;
        }
    }
}
