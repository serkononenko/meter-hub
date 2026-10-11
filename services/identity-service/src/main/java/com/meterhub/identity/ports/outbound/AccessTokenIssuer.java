package com.meterhub.identity.ports.outbound;

import com.meterhub.identity.domain.model.SystemRole;
import com.meterhub.identity.ports.model.IssuedToken;

import java.util.Set;
import java.util.UUID;

public interface AccessTokenIssuer {
    IssuedToken issue(UUID subject, Set<SystemRole> roles);
}
