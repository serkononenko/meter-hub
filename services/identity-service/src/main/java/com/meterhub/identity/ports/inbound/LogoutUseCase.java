package com.meterhub.identity.ports.inbound;

import com.meterhub.identity.ports.model.RefreshCommand;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface LogoutUseCase {
    void logout(RefreshCommand command, UUID accessTokenJti, OffsetDateTime accessTokenExpiresAt);
}
