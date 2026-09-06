package com.meterhub.identity.ports.inbound;

import com.meterhub.identity.ports.model.RefreshCommand;

public interface LogoutUseCase {
    void logout(RefreshCommand command);
}
