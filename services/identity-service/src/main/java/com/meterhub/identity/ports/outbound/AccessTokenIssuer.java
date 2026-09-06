package com.meterhub.identity.ports.outbound;

import com.meterhub.identity.ports.model.IssuedToken;

import java.util.UUID;

public interface AccessTokenIssuer {
    IssuedToken issue(UUID subject);
}
