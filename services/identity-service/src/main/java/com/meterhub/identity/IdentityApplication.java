package com.meterhub.identity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IdentityApplication {

    static void main(String[] args) {
        SpringApplication.run(IdentityApplication.class, args);
    }

}
