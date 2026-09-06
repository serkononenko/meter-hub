package com.meterhub.identity.ports.model;

public record IssuedToken(String tokenValue, long expiresIn) {
}
