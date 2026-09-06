package com.meterhub.identity.ports.inbound;

import com.meterhub.identity.ports.model.LoginCommand;
import com.meterhub.identity.ports.model.LoginResult;

public interface LoginUseCase {
    LoginResult login(LoginCommand command);
}
