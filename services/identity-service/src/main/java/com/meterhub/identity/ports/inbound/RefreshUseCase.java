package com.meterhub.identity.ports.inbound;

import com.meterhub.identity.ports.model.LoginResult;
import com.meterhub.identity.ports.model.RefreshCommand;

public interface RefreshUseCase {
    LoginResult refresh(RefreshCommand command);
}
