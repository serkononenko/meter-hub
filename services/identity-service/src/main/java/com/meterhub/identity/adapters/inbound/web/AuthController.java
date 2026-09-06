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
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class AuthController implements AuthApi {
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
        logoutUseCase.logout(AuthMapper.toCommand(logoutRequest));

        return ResponseEntity.noContent().build();
    }
}
