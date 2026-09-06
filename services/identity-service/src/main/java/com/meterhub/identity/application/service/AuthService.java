package com.meterhub.identity.application.service;

import com.meterhub.identity.domain.exception.InvalidCredentialsException;
import com.meterhub.identity.domain.model.AccountStatus;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.inbound.LoginUseCase;
import com.meterhub.identity.ports.model.IssuedToken;
import com.meterhub.identity.ports.model.LoginCommand;
import com.meterhub.identity.ports.model.LoginResult;
import com.meterhub.identity.ports.outbound.AccessTokenIssuer;
import com.meterhub.identity.ports.outbound.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService implements LoginUseCase {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenIssuer accessTokenIssuer;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, AccessTokenIssuer accessTokenIssuer) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessTokenIssuer = accessTokenIssuer;
    }

    @Override
    public LoginResult login(LoginCommand command) {
        User user = userRepository.findByEmail(command.email()).orElse(null);
        boolean passwordMatches = user != null && passwordEncoder.matches(command.password(), user.passwordHash());
        if (user == null || !passwordMatches || user.status() != AccountStatus.ACTIVE) {
            log.info("Login rejected: no usable account for the submitted credentials");
            throw new InvalidCredentialsException();
        }

        IssuedToken issued = accessTokenIssuer.issue(user.id());
        return new LoginResult(user, issued.tokenValue(), issued.expiresIn());
    }
}
