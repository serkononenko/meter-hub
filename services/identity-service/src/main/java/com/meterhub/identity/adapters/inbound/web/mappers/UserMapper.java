package com.meterhub.identity.adapters.inbound.web.mappers;

import com.meterhub.identity.adapters.inbound.web.dto.RegisterRequestDto;
import com.meterhub.identity.adapters.inbound.web.dto.UserDto;
import com.meterhub.identity.application.command.CreateUserCommand;
import com.meterhub.identity.domain.model.AccountStatus;
import com.meterhub.identity.domain.model.User;

/**
 * Maps between generated web DTOs and the domain model. Both the DTO and the
 * domain record are named User, so the DTO is always fully qualified here.
 * Passwords are one-way: they enter as raw text on RegisterRequest and leave
 * as passwordHash on the domain User — never mapped back to a response DTO.
 */
public final class UserMapper {

    private UserMapper() {
    }

    public static CreateUserCommand toCommand(RegisterRequestDto request) {
        return new CreateUserCommand(request.getEmail(), request.getUsername(), request.getPassword());
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

    private static UserDto.StatusEnum toStatusDto(AccountStatus status) {
        return UserDto.StatusEnum.fromValue(status.name());
    }
}
