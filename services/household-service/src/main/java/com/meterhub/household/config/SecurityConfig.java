package com.meterhub.household.config;

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

import com.meterhub.household.adapters.inbound.web.BearerTokenAuthenticationEntryPoint;

/**
 * Every endpoint requires a valid access token issued by the Identity Service.
 * The gateway already validates JWTs at the edge; this service re-validates
 * them locally as defense in depth.
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
