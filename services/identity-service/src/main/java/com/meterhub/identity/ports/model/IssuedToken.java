package com.meterhub.identity.ports.model;

import java.util.UUID;

public record IssuedToken(String tokenValue, UUID jti, long expiresIn) {
}
