package com.meterhub.gateway.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;

import java.io.IOException;
import java.io.StringReader;
import java.security.interfaces.RSAPublicKey;

/**
 * Loads the identity service RSA public key from {@link JwtProperties}.
 *
 * <p>The gateway holds only the public half: it verifies RS256 signatures and
 * never signs anything, so the identity service's private key never leaves
 * that service.
 */
@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {

    @Bean
    RsaKeyMaterial rsaKeyMaterial(JwtProperties properties) {
        return new RsaKeyMaterial(parsePublicKey(properties.publicKey()));
    }

    private RSAPublicKey parsePublicKey(String pem) {
        try (PEMParser parser = new PEMParser(new StringReader(pem))) {
            Object parsed = parser.readObject();
            if (parsed == null) {
                throw new IllegalArgumentException("Invalid PEM key material");
            }
            if (parsed instanceof SubjectPublicKeyInfo info) {
                return (RSAPublicKey) new JcaPEMKeyConverter().getPublicKey(info);
            }
            throw new IllegalArgumentException("PEM does not contain a public key");
        } catch (org.bouncycastle.openssl.PEMException e) {
            throw new IllegalArgumentException("Invalid PEM public key", e);
        } catch (IOException e) {
            throw new IllegalArgumentException("Invalid PEM key material", e);
        }
    }
}
