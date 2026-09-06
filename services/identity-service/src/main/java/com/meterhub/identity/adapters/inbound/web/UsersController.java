package com.meterhub.identity.adapters.inbound.web;

import com.meterhub.identity.adapters.inbound.web.api.UsersApi;
import com.meterhub.identity.adapters.inbound.web.dto.UserDto;
import com.meterhub.identity.adapters.inbound.web.mappers.AuthMapper;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.inbound.GetUserUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class UsersController implements UsersApi {

    private final GetUserUseCase getUserUseCase;
    private final SpringSecurityAuthProvider springSecurityAuthProvider;

    public UsersController(GetUserUseCase getUserUseCase, SpringSecurityAuthProvider springSecurityAuthProvider) {
        this.getUserUseCase = getUserUseCase;
        this.springSecurityAuthProvider = springSecurityAuthProvider;
    }

    @Override
    public ResponseEntity<UserDto> getCurrentUser(UUID xCorrelationID) {
        User user = getUserUseCase.getUser(springSecurityAuthProvider.currentUserId());

        return ResponseEntity.ok(AuthMapper.toDto(user));
    }
}
