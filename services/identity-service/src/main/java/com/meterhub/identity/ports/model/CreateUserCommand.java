package com.meterhub.identity.ports.model;

public record CreateUserCommand(
    String email,
    String username,
    String password
) {
}
