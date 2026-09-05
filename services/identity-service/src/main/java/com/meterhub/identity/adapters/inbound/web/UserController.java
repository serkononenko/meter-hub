package com.meterhub.identity.adapters.inbound.web;

import com.meterhub.identity.ports.inbound.CreateUserUseCase;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {
    private final CreateUserUseCase createUserUseCase;

    public UserController(CreateUserUseCase createUserUseCase) {
        this.createUserUseCase = createUserUseCase;
    }
}
