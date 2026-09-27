package com.meterhub.identity.adapters.inbound.web;

import com.meterhub.identity.adapters.inbound.web.api.AuthApi;
import com.meterhub.identity.adapters.inbound.web.dto.LoginRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.LoginResponseDto;
import com.meterhub.identity.adapters.inbound.web.dto.LogoutRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.RefreshRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.RegisterRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.UserDto;
import com.meterhub.identity.adapters.inbound.web.mappers.AuthMapper;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.inbound.CreateUserUseCase;
import com.meterhub.identity.ports.inbound.LoginUseCase;
import com.meterhub.identity.ports.inbound.LogoutUseCase;
import com.meterhub.identity.ports.inbound.RefreshUseCase;
import com.meterhub.identity.ports.model.LoginResult;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

@RestController
public class AuthController implements AuthApi {
    private static final String BEARER_PREFIX = "Bearer ";

    private final CreateUserUseCase createUserUseCase;
    private final LoginUseCase loginUseCase;
    private final RefreshUseCase refreshUseCase;
    private final LogoutUseCase logoutUseCase;

    public AuthController(
        CreateUserUseCase createUserUseCase,
        LoginUseCase loginUseCase,
        RefreshUseCase refreshUseCase,
        LogoutUseCase logoutUseCase
    ) {
        this.createUserUseCase = createUserUseCase;
        this.loginUseCase = loginUseCase;
        this.refreshUseCase = refreshUseCase;
        this.logoutUseCase = logoutUseCase;
    }

    @Override
    public ResponseEntity<UserDto> registerUser(RegisterRequestDto registerRequest, UUID xCorrelationID) {
        User user = createUserUseCase.create(AuthMapper.toCommand(registerRequest));

        return ResponseEntity.status(201).body(AuthMapper.toDto(user));
    }

    @Override
    public ResponseEntity<LoginResponseDto> loginUser(LoginRequestDto loginRequest, UUID xCorrelationID) {
        LoginResult result = loginUseCase.login(AuthMapper.toCommand(loginRequest));

        return ResponseEntity.ok(AuthMapper.toDto(result));
    }

    @Override
    public ResponseEntity<LoginResponseDto> refreshToken(RefreshRequestDto refreshRequest, UUID xCorrelationID) {
        LoginResult result = refreshUseCase.refresh(AuthMapper.toCommand(refreshRequest));

        return ResponseEntity.ok(AuthMapper.toDto(result));
    }

    @Override
    public ResponseEntity<Void> logoutUser(LogoutRequestDto logoutRequest, UUID xCorrelationID) {
        // The access token is optional (legacy clients send none): when
        // present, its jti is revoked too so the gateway stops accepting it
        // within the cache poll interval, instead of the token living out
        // its full TTL.
        AccessTokenClaims access = bearerToken(currentRequest())
            .flatMap(AuthController::parseAccessTokenClaims)
            .orElse(null);

        logoutUseCase.logout(
            AuthMapper.toCommand(logoutRequest),
            access == null ? null : access.jti(),
            access == null ? null : access.expiresAt()
        );

        return ResponseEntity.noContent().build();
    }

    private record AccessTokenClaims(UUID jti, OffsetDateTime expiresAt) {
    }

    /**
     * The generated AuthApi declares no HttpServletRequest parameter, so the
     * Authorization header is read off the current request bound by Spring MVC.
     */
    private static HttpServletRequest currentRequest() {
        return (HttpServletRequest) RequestContextHolder.currentRequestAttributes()
            .resolveReference(RequestAttributes.REFERENCE_REQUEST);
    }

    private static Optional<String> bearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            return Optional.empty();
        }
        return Optional.of(header.substring(BEARER_PREFIX.length()));
    }

    /**
     * Parses the Bearer token for logout's revocation. Signature verification
     * is deliberately skipped — logout only records a jti, and recording a
     * forged one harms no one: no issued token carries it, so the gateway's
     * cache entry is inert. The expiry bounds how long that entry is kept.
     */
    private static Optional<AccessTokenClaims> parseAccessTokenClaims(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            UUID jti = UUID.fromString(jwt.getJWTClaimsSet().getStringClaim("jti"));
            Instant expiresAtInstant = jwt.getJWTClaimsSet().getExpirationTime().toInstant();
            OffsetDateTime expiresAt = OffsetDateTime.ofInstant(expiresAtInstant, ZoneOffset.UTC);

            return Optional.of(new AccessTokenClaims(jti, expiresAt));
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
