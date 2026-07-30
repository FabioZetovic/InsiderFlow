package com.insiderflow.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 2, max = 40)
            @Pattern(regexp = "^[\\p{L}0-9 .'\\-]{2,40}$",
                    message = "Username may contain letters, numbers, spaces, and . ' -")
            String username,
            @NotBlank
            @Size(min = 8, max = 72, message = "Password must be 8–72 characters")
            @Pattern(regexp = "^(?=.*[0-9])(?=.*[A-Z]).{8,}$",
                    message = "Password must be at least 8 characters with at least 1 number and 1 uppercase letter")
            String password
    ) {
    }

    public record LoginRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 72) String password
    ) {
    }

    public record AuthResponse(String token, UserInfo user) {
    }

    public record UserInfo(String id, String email, String username) {
        public static UserInfo from(User user) {
            return new UserInfo(user.getId(), user.getEmail(), user.getUsername());
        }
    }
}
