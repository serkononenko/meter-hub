package com.meterhub.identity.application.service;

import com.meterhub.identity.config.JwtProperties;
import com.meterhub.identity.domain.exception.InvalidCredentialsException;
import com.meterhub.identity.domain.exception.InvalidRefreshTokenException;
import com.meterhub.identity.domain.model.AccountStatus;
import com.meterhub.identity.domain.model.RefreshToken;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.model.LoginCommand;
import com.meterhub.identity.ports.model.LoginResult;
import com.meterhub.identity.ports.model.RefreshCommand;
import com.meterhub.identity.ports.outbound.AccessTokenIssuer;
import com.meterhub.identity.ports.outbound.RefreshTokenRepository;
import com.meterhub.identity.ports.outbound.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the auth application service (task 9.2). Covers the login,
 * refresh, and logout flows without Spring or a database — every failure
 * mode must surface as the same reason-free exception so callers cannot
 * enumerate accounts or token state.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final UUID USER_ID = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
    private static final String EMAIL = "jane.doe@example.com";
    private static final String PASSWORD = "correct-horse-battery";
    private static final String PASSWORD_HASH = "$2a$10$storedhash";

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AccessTokenIssuer accessTokenIssuer;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        JwtProperties jwtProperties = new JwtProperties(
            "meterhub-identity",
            "meterhub",
            Duration.ofMinutes(15),
            Duration.ofDays(30),
            "private-key",
            "public-key"
        );
        authService = new AuthService(
            userRepository,
            refreshTokenRepository,
            passwordEncoder,
            accessTokenIssuer,
            jwtProperties
        );
    }

    @Test
    void loginReturnsAccessAndRefreshTokensForValidCredentials() {
        User user = activeUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        when(accessTokenIssuer.issue(USER_ID)).thenReturn(new com.meterhub.identity.ports.model.IssuedToken("jwt-value", 900L));
        when(refreshTokenRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        LoginResult result = authService.login(new LoginCommand(EMAIL, PASSWORD));

        assertThat(result.user()).isEqualTo(user);
        assertThat(result.accessToken()).isEqualTo("jwt-value");
        assertThat(result.expiresIn()).isEqualTo(900L);
        assertThat(result.refreshToken()).isNotBlank();
    }

    @Test
    void loginStoresOnlyTheHashOfTheIssuedRefreshToken() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(activeUser()));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        when(accessTokenIssuer.issue(USER_ID)).thenReturn(new com.meterhub.identity.ports.model.IssuedToken("jwt-value", 900L));
        when(refreshTokenRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        LoginResult result = authService.login(new LoginCommand(EMAIL, PASSWORD));

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        RefreshToken stored = captor.getValue();
        assertThat(stored.tokenHash()).isEqualTo(sha256Hex(result.refreshToken()));
        assertThat(stored.tokenHash()).doesNotContain(result.refreshToken());
        assertThat(stored.userId()).isEqualTo(USER_ID);
        assertThat(stored.revokedAt()).isNull();
        assertThat(stored.expiresAt()).isAfter(OffsetDateTime.now());
    }

    @Test
    void loginRejectsUnknownEmailWithTheSameErrorAsWrongPassword() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginCommand(EMAIL, PASSWORD)))
            .isInstanceOf(InvalidCredentialsException.class);
        verify(passwordEncoder, never()).matches(any(), any());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void loginRejectsWrongPassword() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(activeUser()));
        when(passwordEncoder.matches("wrong-password", PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginCommand(EMAIL, "wrong-password")))
            .isInstanceOf(InvalidCredentialsException.class);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void loginRejectsDisabledAccount() {
        User disabled = activeUser(AccountStatus.DISABLED);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(disabled));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);

        assertThatThrownBy(() -> authService.login(new LoginCommand(EMAIL, PASSWORD)))
            .isInstanceOf(InvalidCredentialsException.class);
        verify(accessTokenIssuer, never()).issue(any());
    }

    @Test
    void loginRejectsLockedAccount() {
        User locked = activeUser(AccountStatus.LOCKED);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(locked));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);

        assertThatThrownBy(() -> authService.login(new LoginCommand(EMAIL, PASSWORD)))
            .isInstanceOf(InvalidCredentialsException.class);
        verify(accessTokenIssuer, never()).issue(any());
    }

    @Test
    void refreshRotatesTheTokenPairAndRevokesThePresentedToken() {
        String rawToken = "raw-refresh-token";
        RefreshToken stored = storedToken(rawToken, null);
        when(refreshTokenRepository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(stored));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(activeUser()));
        when(accessTokenIssuer.issue(USER_ID)).thenReturn(new com.meterhub.identity.ports.model.IssuedToken("new-jwt", 900L));
        when(refreshTokenRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        LoginResult result = authService.refresh(new RefreshCommand(rawToken));

        verify(refreshTokenRepository).revoke(stored);
        assertThat(result.accessToken()).isEqualTo("new-jwt");
        assertThat(result.refreshToken()).isNotEqualTo(rawToken);
    }

    @Test
    void refreshRejectsUnknownToken() {
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refresh(new RefreshCommand("unknown-token")))
            .isInstanceOf(InvalidRefreshTokenException.class);
        verify(accessTokenIssuer, never()).issue(any());
    }

    @Test
    void refreshRejectsExpiredToken() {
        String rawToken = "expired-token";
        RefreshToken expired = storedToken(rawToken, null, OffsetDateTime.now().minusSeconds(1));
        when(refreshTokenRepository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> authService.refresh(new RefreshCommand(rawToken)))
            .isInstanceOf(InvalidRefreshTokenException.class);
        verify(refreshTokenRepository, never()).revoke(any());
    }

    @Test
    void refreshRejectsRevokedToken() {
        String rawToken = "revoked-token";
        RefreshToken revoked = storedToken(rawToken, OffsetDateTime.now().minusMinutes(5));
        when(refreshTokenRepository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(revoked));

        assertThatThrownBy(() -> authService.refresh(new RefreshCommand(rawToken)))
            .isInstanceOf(InvalidRefreshTokenException.class);
        verify(refreshTokenRepository, never()).revoke(any());
    }

    @Test
    void refreshRejectsWhenTheAccountIsNoLongerActive() {
        String rawToken = "usable-token";
        when(refreshTokenRepository.findByTokenHash(sha256Hex(rawToken)))
            .thenReturn(Optional.of(storedToken(rawToken, null)));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(activeUser(AccountStatus.DISABLED)));

        assertThatThrownBy(() -> authService.refresh(new RefreshCommand(rawToken)))
            .isInstanceOf(InvalidRefreshTokenException.class);
        verify(accessTokenIssuer, never()).issue(any());
    }

    @Test
    void logoutRevokesThePresentedToken() {
        String rawToken = "logout-token";
        RefreshToken stored = storedToken(rawToken, null);
        when(refreshTokenRepository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(stored));

        authService.logout(new RefreshCommand(rawToken));

        verify(refreshTokenRepository).revoke(stored);
    }

    @Test
    void logoutIsIdempotentForUnknownTokens() {
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        authService.logout(new RefreshCommand("unknown-token"));

        verify(refreshTokenRepository, never()).revoke(any());
    }

    private User activeUser() {
        return activeUser(AccountStatus.ACTIVE);
    }

    private User activeUser(AccountStatus status) {
        return new User(
            USER_ID,
            EMAIL,
            "jane.doe",
            PASSWORD_HASH,
            status,
            OffsetDateTime.now().minusDays(1),
            OffsetDateTime.now().minusDays(1)
        );
    }

    private RefreshToken storedToken(String rawToken, OffsetDateTime revokedAt) {
        return storedToken(rawToken, revokedAt, OffsetDateTime.now().plusDays(1));
    }

    private RefreshToken storedToken(String rawToken, OffsetDateTime revokedAt, OffsetDateTime expiresAt) {
        return new RefreshToken(UUID.randomUUID(), USER_ID, sha256Hex(rawToken), expiresAt, revokedAt, OffsetDateTime.now().minusDays(1));
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
