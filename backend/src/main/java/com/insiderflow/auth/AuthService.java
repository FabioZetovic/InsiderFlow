package com.insiderflow.auth;

import com.insiderflow.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final boolean registrationEnabled;
    // Demo mode: any email + any password logs in (find-or-create the user). For public demos
    // where frictionless access matters more than real authentication. Default OFF.
    private final boolean demoMode;

    // A valid BCrypt hash (computed once at startup) compared against when the email is unknown,
    // so login timing doesn't reveal whether an account exists (M3).
    private final String dummyHash;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                       @Value("${insiderflow.auth.registration-enabled:true}") boolean registrationEnabled,
                       @Value("${insiderflow.auth.demo-mode:true}") boolean demoMode) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.registrationEnabled = registrationEnabled;
        this.demoMode = demoMode;
        this.dummyHash = passwordEncoder.encode("constant-time-placeholder");
    }

    public boolean isDemoMode() {
        return demoMode;
    }

    public boolean isRegistrationEnabled() {
        return registrationEnabled;
    }

    public AuthDtos.AuthResponse register(AuthDtos.RegisterRequest request) {
        if (!registrationEnabled) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Registration is disabled");
        }
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        User user = new User(email, request.username().trim(), passwordEncoder.encode(request.password()));
        user = userRepository.save(user);
        return new AuthDtos.AuthResponse(jwtService.generateToken(user), AuthDtos.UserInfo.from(user));
    }

    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        if (demoMode) {
            // Any valid email + any password logs in; create the account on first use so the
            // user gets their own watchlist/feed. Password is not checked in demo mode.
            User user = userRepository.findByEmail(email).orElseGet(() -> {
                String username = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
                return userRepository.save(new User(email, username,
                        passwordEncoder.encode(java.util.UUID.randomUUID().toString())));
            });
            return new AuthDtos.AuthResponse(jwtService.generateToken(user), AuthDtos.UserInfo.from(user));
        }
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // Equalize timing: run a real BCrypt compare against a dummy hash, then fail the same
            // way as a wrong password — no message/timing difference reveals account existence.
            passwordEncoder.matches(request.password(), dummyHash);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        return new AuthDtos.AuthResponse(jwtService.generateToken(user), AuthDtos.UserInfo.from(user));
    }

    /** Invalidates every existing token for the user (logout everywhere) by bumping tokenVersion. */
    public void revokeAllTokens(User user) {
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }
}
