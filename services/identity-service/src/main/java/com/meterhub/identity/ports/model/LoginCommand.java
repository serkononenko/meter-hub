package com.meterhub.identity.ports.model;

public record LoginCommand(String email, String password) {
}
