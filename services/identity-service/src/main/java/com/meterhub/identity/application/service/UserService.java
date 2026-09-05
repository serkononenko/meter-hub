package com.meterhub.identity.application.service;

import com.meterhub.identity.application.command.CreateUserCommand;
import com.meterhub.identity.domain.exception.DuplicateIdentityException;
import com.meterhub.identity.domain.model.AccountStatus;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.inbound.CreateUserUseCase;
import com.meterhub.identity.ports.outbound.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class UserService implements CreateUserUseCase {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public User create(CreateUserCommand command) {
        userRepository.findByEmail(command.email()).ifPresent(_ -> {
            throw new DuplicateIdentityException("email");
        });
        userRepository.findByUsername(command.username()).ifPresent(_ -> {
            throw new DuplicateIdentityException("username");
        });

        OffsetDateTime now = OffsetDateTime.now();
        User user = User.builder()
            .id(UUID.randomUUID())
            .email(command.email())
            .username(command.username())
            .passwordHash(passwordEncoder.encode(command.password()))
            .status(AccountStatus.ACTIVE)
            .createdAt(now)
            .updatedAt(now)
            .build();

        return userRepository.save(user);
    }
}
