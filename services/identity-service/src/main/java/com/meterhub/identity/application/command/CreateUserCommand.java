package com.meterhub.identity.application.command;

public record CreateUserCommand(
    String email,
    String username,
    String password
) {
}
