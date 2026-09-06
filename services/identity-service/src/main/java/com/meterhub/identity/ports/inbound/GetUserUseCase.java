package com.meterhub.identity.ports.inbound;

import com.meterhub.identity.domain.model.User;

import java.util.UUID;

public interface GetUserUseCase {
    User getUser(UUID userId);
}
