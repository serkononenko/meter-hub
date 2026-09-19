package com.meterhub.gateway.config;

import com.meterhub.gateway.security.BearerTokenAuthenticationEntryPoint;
import com.meterhub.gateway.web.CorrelationIdFilter;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Duration;
import java.util.List;

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
        BearerTokenAuthenticationEntryPoint authenticationEntryPoint,
        CorsConfigurationSource corsConfigurationSource
    ) {
        http
            // Stateless token-based API: CSRF protection does not apply
            .csrf(AbstractHttpConfigurer::disable)
            // The web client is a separate origin; browsers enforce CORS here
            // at the gateway so preflights never reach a downstream service
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .authorizeHttpRequests(auth -> auth
                // Container ERROR dispatches (proxy failures rendered as /error)
                // carry no Authorization header, so they must not re-run the
                // auth rules; the original request was already authorized
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                // Health probes must not need a token; auth endpoints authenticate
                // by the request body itself (login, register, refresh, logout).
                // Path matchers see the original request path, i.e. with the
                // /api/<service-name> prefix that the gateway routes strip later.
                // /actuator/health/** covers the liveness and readiness probe
                // subpaths as well as the aggregate endpoint
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/api/identity-service/api/v1/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.decoder(jwtDecoder(jwtProperties, rsaKeyMaterial)))
                .authenticationEntryPoint(authenticationEntryPoint)
            );

        return http.build();
    }

    /**
     * Allows the browser client to call the API from another origin. Allowed
     * origins are explicit, not "*", because the API reads the Authorization
     * header; they are configurable so non-local environments can list their
     * own client origins.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(
        @Value("${CORS_ALLOWED_ORIGINS:http://localhost:3000,http://127.0.0.1:3000}") List<String> allowedOrigins
    ) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of(CorrelationIdFilter.HEADER));
        config.setMaxAge(Duration.ofHours(1));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
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
