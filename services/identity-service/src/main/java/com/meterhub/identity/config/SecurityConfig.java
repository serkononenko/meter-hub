package com.meterhub.identity.config;

import com.meterhub.identity.adapters.inbound.web.BearerTokenAuthenticationEntryPoint;
import com.meterhub.identity.adapters.outbound.token.RsaKeyMaterial;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        RsaKeyMaterial rsaKeyMaterial,
        BearerTokenAuthenticationEntryPoint authenticationEntryPoint
    ) {
        http
            // Stateless token-based API: CSRF protection does not apply
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                // Login, registration, refresh and logout authenticate by the
                // request body itself; everything else requires a bearer token
                .requestMatchers("/api/v1/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.decoder(NimbusJwtDecoder.withPublicKey(rsaKeyMaterial.publicKey()).build()))
                .authenticationEntryPoint(authenticationEntryPoint)
            );

        return http.build();
    }
}
