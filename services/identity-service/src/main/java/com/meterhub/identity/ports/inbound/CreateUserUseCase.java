package com.meterhub.identity.ports.inbound;

import com.meterhub.identity.application.command.CreateUserCommand;
import com.meterhub.identity.domain.model.User;

public interface CreateUserUseCase {
    User create(CreateUserCommand command);
}
