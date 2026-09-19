package com.meterhub.identity.application.service;

import com.meterhub.identity.domain.exception.DuplicateIdentityException;
import com.meterhub.identity.domain.exception.InvalidAccessTokenException;
import com.meterhub.identity.domain.model.AccountStatus;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.model.CreateUserCommand;
import com.meterhub.identity.ports.outbound.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the user application service (task 9.2). Covers registration
 * uniqueness rules and current-user lookup without Spring or a database.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final UUID USER_ID = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
    private static final String EMAIL = "jane.doe@example.com";
    private static final String USERNAME = "jane.doe";
    private static final String PASSWORD = "correct-horse-battery";
    private static final String PASSWORD_HASH = "$2a$10$storedhash";

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, passwordEncoder);
    }

    @Test
    void createHashesThePasswordAndStoresAnActiveUser() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(PASSWORD)).thenReturn(PASSWORD_HASH);
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        User created = userService.create(new CreateUserCommand(EMAIL, USERNAME, PASSWORD));

        assertThat(created.email()).isEqualTo(EMAIL);
        assertThat(created.username()).isEqualTo(USERNAME);
        assertThat(created.status()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(created.passwordHash()).isEqualTo(PASSWORD_HASH);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().passwordHash()).isEqualTo(PASSWORD_HASH);
        assertThat(captor.getValue().passwordHash()).isNotEqualTo(PASSWORD);
    }

    @Test
    void createRejectsADuplicateEmail() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(existingUser()));

        assertThatThrownBy(() -> userService.create(new CreateUserCommand(EMAIL, USERNAME, PASSWORD)))
            .isInstanceOf(DuplicateIdentityException.class)
            .extracting(e -> ((DuplicateIdentityException) e).getField())
            .isEqualTo("email");
        verify(userRepository, never()).save(any());
    }

    @Test
    void createRejectsADuplicateUsername() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.of(existingUser()));

        assertThatThrownBy(() -> userService.create(new CreateUserCommand(EMAIL, USERNAME, PASSWORD)))
            .isInstanceOf(DuplicateIdentityException.class)
            .extracting(e -> ((DuplicateIdentityException) e).getField())
            .isEqualTo("username");
        verify(userRepository, never()).save(any());
    }

    @Test
    void createChecksUsernameEvenWhenEmailIsFree() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(PASSWORD)).thenReturn(PASSWORD_HASH);
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        userService.create(new CreateUserCommand(EMAIL, USERNAME, PASSWORD));

        verify(userRepository).findByUsername(USERNAME);
    }

    @Test
    void getUserReturnsTheUserForAValidId() {
        User user = existingUser();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        assertThat(userService.getUser(USER_ID)).isEqualTo(user);
    }

    @Test
    void getUserRejectsAnUnknownUserIdWithTheTokenRejectionError() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUser(USER_ID))
            .isInstanceOf(InvalidAccessTokenException.class);
    }

    private User existingUser() {
        return new User(
            USER_ID,
            EMAIL,
            USERNAME,
            PASSWORD_HASH,
            AccountStatus.ACTIVE,
            null,
            null
        );
    }
}
