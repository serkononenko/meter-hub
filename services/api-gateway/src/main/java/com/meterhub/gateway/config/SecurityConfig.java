package com.meterhub.gateway.config;

import com.meterhub.gateway.security.BearerTokenAuthenticationEntryPoint;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * JWT validation at the gateway edge. Every request carries a bearer token
 * that is checked before it is forwarded; downstream services still revalidate
 * their own tokens (defense in depth), so this is an early-reject layer.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        JwtProperties jwtProperties,
        RsaKeyMaterial rsaKeyMaterial,
        BearerTokenAuthenticationEntryPoint authenticationEntryPoint
    ) {
        http
            // Stateless token-based API: CSRF protection does not apply
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                // Container ERROR dispatches (proxy failures rendered as /error)
                // carry no Authorization header, so they must not re-run the
                // auth rules; the original request was already authorized
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                // Health probes must not need a token; auth endpoints authenticate
                // by the request body itself (login, register, refresh, logout)
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/api/v1/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.decoder(jwtDecoder(jwtProperties, rsaKeyMaterial)))
                .authenticationEntryPoint(authenticationEntryPoint)
            );

        return http.build();
    }

    private JwtDecoder jwtDecoder(JwtProperties jwtProperties, RsaKeyMaterial rsaKeyMaterial) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(rsaKeyMaterial.publicKey()).build();
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(jwtProperties.issuer()),
            new JwtAudienceValidator(jwtProperties.audience())
        );
        decoder.setJwtValidator(validator);
        return decoder;
    }
}
