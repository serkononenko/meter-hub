package com.meterhub.identity.adapters.outbound.token;

import com.meterhub.identity.config.JwtProperties;
import com.meterhub.identity.ports.model.IssuedToken;
import com.meterhub.identity.ports.outbound.AccessTokenIssuer;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;

import java.time.Instant;
import java.util.List;
import java.util.UUID;


/**
 * Signs short-lived RS256 access tokens with Nimbus (Spring Security OAuth2
 * JOSE). Claims follow the MeterHub security contract: iss, sub, aud, exp,
 * iat — nothing else, so downstream services validate a small stable set.
 */
@Component
public class JwtAccessTokenIssuer implements AccessTokenIssuer {

    private final JwtEncoder jwtEncoder;
    private final JwtProperties properties;

    public JwtAccessTokenIssuer(RsaKeyMaterial keyMaterial, JwtProperties properties) {
        this.jwtEncoder = buildJwtEncoder(keyMaterial);
        this.properties = properties;
    }

    @Override
    public IssuedToken issue(UUID subject) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(properties.accessTokenTtl());

        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(properties.issuer())
            .subject(subject.toString())
            .audience(List.of(properties.audience()))
            .issuedAt(now)
            .expiresAt(expiresAt)
            .build();
        JwsHeader jwsHeader = JwsHeader.with(SignatureAlgorithm.RS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(jwsHeader, claims)).getTokenValue();

        return new IssuedToken(token, properties.accessTokenTtl().toSeconds());
    }

    private NimbusJwtEncoder buildJwtEncoder(RsaKeyMaterial keyMaterial) {
        RSAKey rsaKey = new RSAKey.Builder(keyMaterial.publicKey())
            .privateKey(keyMaterial.privateKey())
            .keyUse(KeyUse.SIGNATURE)
            .build();
        String kid;
        try {
            kid = rsaKey.computeThumbprint().toString();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to compute RFC 7638 thumbprint", e);
        }
        RSAKey key = new RSAKey.Builder(rsaKey).keyID(kid).build();

        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(key)));
    }
}
