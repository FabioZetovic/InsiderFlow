package com.insiderflow.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;

    public AuthController(AuthService authService, LoginRateLimiter rateLimiter) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
    }

    /** Public: lets the login page know if demo mode / registration are on. */
    @GetMapping("/config")
    public java.util.Map<String, Boolean> config() {
        return java.util.Map.of(
                "demoMode", authService.isDemoMode(),
                "registrationEnabled", authService.isRegistrationEnabled());
    }

    @PostMapping("/register")
    public ResponseEntity<AuthDtos.AuthResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest request,
                                                          HttpServletRequest http) {
        rateLimiter.checkAllowed(http.getRemoteAddr(), request.email());
        try {
            AuthDtos.AuthResponse response = authService.register(request);
            rateLimiter.recordSuccess(http.getRemoteAddr(), request.email());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            rateLimiter.recordFailure(http.getRemoteAddr(), request.email());
            throw e;
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthDtos.AuthResponse> login(@Valid @RequestBody AuthDtos.LoginRequest request,
                                                       HttpServletRequest http) {
        rateLimiter.checkAllowed(http.getRemoteAddr(), request.email());
        try {
            AuthDtos.AuthResponse response = authService.login(request);
            rateLimiter.recordSuccess(http.getRemoteAddr(), request.email());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            rateLimiter.recordFailure(http.getRemoteAddr(), request.email());
            throw e;
        }
    }

    @GetMapping("/me")
    public ResponseEntity<AuthDtos.UserInfo> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(AuthDtos.UserInfo.from(user));
    }

    /** Logout everywhere — invalidates all existing tokens for the authenticated user. */
    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        authService.revokeAllTokens(user);
        return ResponseEntity.noContent().build();
    }
}
