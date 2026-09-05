package com.meterhub.identity.adapters.inbound.web;

import com.meterhub.identity.adapters.inbound.web.api.AuthApi;
import com.meterhub.identity.adapters.inbound.web.dto.RegisterRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.UserDto;
import com.meterhub.identity.adapters.inbound.web.mappers.UserMapper;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.inbound.CreateUserUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class UserController implements AuthApi {
    private final CreateUserUseCase createUserUseCase;

    public UserController(CreateUserUseCase createUserUseCase) {
        this.createUserUseCase = createUserUseCase;
    }

    @Override
    public ResponseEntity<UserDto> registerUser(RegisterRequestDto registerRequest, UUID xCorrelationID) {
        User user = createUserUseCase.create(UserMapper.toCommand(registerRequest));

        return ResponseEntity.status(201).body(UserMapper.toDto(user));
    }
}
