package com.meterhub.identity.adapters.inbound.web;

import com.meterhub.identity.adapters.inbound.web.api.AuthApi;
import com.meterhub.identity.adapters.inbound.web.dto.LoginRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.LoginResponseDto;
import com.meterhub.identity.adapters.inbound.web.dto.RegisterRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.UserDto;
import com.meterhub.identity.adapters.inbound.web.mappers.UserMapper;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.inbound.CreateUserUseCase;
import com.meterhub.identity.ports.inbound.LoginUseCase;
import com.meterhub.identity.ports.model.LoginResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class UserController implements AuthApi {
    private final CreateUserUseCase createUserUseCase;
    private final LoginUseCase loginUseCase;

    public UserController(CreateUserUseCase createUserUseCase, LoginUseCase loginUseCase) {
        this.createUserUseCase = createUserUseCase;
        this.loginUseCase = loginUseCase;
    }

    @Override
    public ResponseEntity<UserDto> registerUser(RegisterRequestDto registerRequest, UUID xCorrelationID) {
        User user = createUserUseCase.create(UserMapper.toCommand(registerRequest));

        return ResponseEntity.status(201).body(UserMapper.toDto(user));
    }

    @Override
    public ResponseEntity<LoginResponseDto> loginUser(LoginRequestDto loginRequest, UUID xCorrelationID) {
        LoginResult result = loginUseCase.login(UserMapper.toCommand(loginRequest));

        return ResponseEntity.ok(UserMapper.toDto(result));
    }
}
