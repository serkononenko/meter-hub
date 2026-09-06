package com.meterhub.identity.adapters.inbound.web.mappers;

import com.meterhub.identity.adapters.inbound.web.dto.LoginRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.LoginResponseDto;
import com.meterhub.identity.adapters.inbound.web.dto.RegisterRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.UserDto;
import com.meterhub.identity.domain.model.AccountStatus;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.model.CreateUserCommand;
import com.meterhub.identity.ports.model.LoginCommand;
import com.meterhub.identity.ports.model.LoginResult;

public final class UserMapper {

    private UserMapper() {
    }

    public static CreateUserCommand toCommand(RegisterRequestDto request) {
        return new CreateUserCommand(request.getEmail(), request.getUsername(), request.getPassword());
    }

    public static LoginCommand toCommand(LoginRequestDto request) {
        return new LoginCommand(request.getEmail(), request.getPassword());
    }

    public static UserDto toDto(User user) {
        var dto = new UserDto(
            user.id(),
            user.email(),
            user.username(),
            toStatusDto(user.status()),
            user.createdAt()
        );
        dto.setUpdatedAt(user.updatedAt());
        return dto;
    }

    public static LoginResponseDto toDto(LoginResult result) {
        return new LoginResponseDto(
            result.accessToken(),
            LoginResponseDto.TokenTypeEnum.Bearer,
            result.expiresIn(),
            UserMapper.toDto(result.user())
        );
    }

    private static UserDto.StatusEnum toStatusDto(AccountStatus status) {
        return UserDto.StatusEnum.fromValue(status.name());
    }
}
