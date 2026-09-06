package com.meterhub.identity.application.service;

import com.meterhub.identity.domain.exception.InvalidCredentialsException;
import com.meterhub.identity.domain.exception.InvalidRefreshTokenException;
import com.meterhub.identity.domain.model.AccountStatus;
import com.meterhub.identity.domain.model.RefreshToken;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.inbound.LoginUseCase;
import com.meterhub.identity.ports.inbound.LogoutUseCase;
import com.meterhub.identity.ports.inbound.RefreshUseCase;
import com.meterhub.identity.ports.model.IssuedToken;
import com.meterhub.identity.ports.model.LoginCommand;
import com.meterhub.identity.ports.model.LoginResult;
import com.meterhub.identity.ports.model.RefreshCommand;
import com.meterhub.identity.ports.outbound.AccessTokenIssuer;
import com.meterhub.identity.ports.outbound.RefreshTokenRepository;
import com.meterhub.identity.ports.outbound.UserRepository;
import com.meterhub.identity.config.JwtProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class AuthService implements LoginUseCase, RefreshUseCase, LogoutUseCase {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private static final int REFRESH_TOKEN_BYTES = 32;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenIssuer accessTokenIssuer;
    private final JwtProperties jwtProperties;

    public AuthService(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        AccessTokenIssuer accessTokenIssuer,
        JwtProperties jwtProperties
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessTokenIssuer = accessTokenIssuer;
        this.jwtProperties = jwtProperties;
    }

    @Override
    @Transactional
    public LoginResult login(LoginCommand command) {
        User user = userRepository.findByEmail(command.email()).orElse(null);
        boolean passwordMatches = user != null && passwordEncoder.matches(command.password(), user.passwordHash());
        if (user == null || !passwordMatches || user.status() != AccountStatus.ACTIVE) {
            log.info("Login rejected: no usable account for the submitted credentials");
            throw new InvalidCredentialsException();
        }

        return issueTokens(user);
    }

    @Override
    @Transactional
    public LoginResult refresh(RefreshCommand command) {
        String tokenHash = hash(command.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
            .filter(this::isUsable)
            .orElse(null);
        if (stored == null) {
            log.info("Refresh rejected: token is unknown, expired, or revoked");
            throw new InvalidRefreshTokenException();
        }

        refreshTokenRepository.revoke(stored);

        User user = userRepository.findById(stored.userId()).orElseThrow(InvalidRefreshTokenException::new);
        if (user.status() != AccountStatus.ACTIVE) {
            log.info("Refresh rejected: account is no longer active");
            throw new InvalidRefreshTokenException();
        }

        return issueTokens(user);
    }

    @Override
    @Transactional
    public void logout(RefreshCommand command) {
        refreshTokenRepository.findByTokenHash(hash(command.refreshToken()))
            .ifPresent(refreshTokenRepository::revoke);
    }

    private LoginResult issueTokens(User user) {
        IssuedToken access = accessTokenIssuer.issue(user.id());
        String rawRefreshToken = generateRawToken();
        OffsetDateTime now = OffsetDateTime.now();
        refreshTokenRepository.save(new RefreshToken(
            UUID.randomUUID(),
            user.id(),
            hash(rawRefreshToken),
            now.plus(jwtProperties.refreshTokenTtl()),
            null,
            now
        ));

        return new LoginResult(user, access.tokenValue(), rawRefreshToken, access.expiresIn());
    }

    private boolean isUsable(RefreshToken token) {
        return token.revokedAt() == null && token.expiresAt().isAfter(OffsetDateTime.now());
    }

    private String generateRawToken() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
