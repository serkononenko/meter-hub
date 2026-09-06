package com.meterhub.identity.ports.model;

import com.meterhub.identity.domain.model.User;

public record LoginResult(User user, String accessToken, long expiresIn) {
}
