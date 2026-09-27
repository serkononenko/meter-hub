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
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
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

    private static final DefaultBearerTokenResolver BEARER_TOKEN_RESOLVER = new DefaultBearerTokenResolver();

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

    private static HttpServletRequest currentRequest() {
        return (HttpServletRequest) RequestContextHolder.currentRequestAttributes()
            .resolveReference(RequestAttributes.REFERENCE_REQUEST);
    }

    private static Optional<String> bearerToken(HttpServletRequest request) {
        return Optional.ofNullable(BEARER_TOKEN_RESOLVER.resolve(request));
    }

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
