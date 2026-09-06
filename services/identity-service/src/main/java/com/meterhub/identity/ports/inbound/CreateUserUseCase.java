package com.meterhub.identity.ports.inbound;

import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.ports.model.CreateUserCommand;

public interface CreateUserUseCase {
    User create(CreateUserCommand command);
}
