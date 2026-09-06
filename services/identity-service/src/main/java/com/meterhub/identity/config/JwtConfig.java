package com.meterhub.identity.config;

import com.meterhub.identity.adapters.outbound.token.RsaKeyMaterial;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.io.StringReader;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

/**
 * Wires JWT settings and converts PEM key material (PKCS#8 or PKCS#1
 * private keys, SPKI public keys) supplied through configuration into
 * {@link java.security} key objects for the RS256 signer.
 */
@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {

    @Bean
    public RsaKeyMaterial rsaKeyMaterial(JwtProperties properties) {
        if (isBlank(properties.privateKey()) || isBlank(properties.publicKey())) {
            throw new IllegalStateException(
                "identity.jwt.private-key / identity.jwt.public-key must be configured (PEM via environment)");
        }
        return new RsaKeyMaterial(parsePrivateKey(properties.privateKey()), parsePublicKey(properties.publicKey()));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static RSAPrivateKey parsePrivateKey(String pem) {
        JcaPEMKeyConverter converter = new JcaPEMKeyConverter();
        Object parsed = readPem(pem);
        try {
            if (parsed instanceof PEMKeyPair pair) {
                return (RSAPrivateKey) converter.getPrivateKey(pair.getPrivateKeyInfo());
            }
            if (parsed instanceof PrivateKeyInfo info) {
                return (RSAPrivateKey) converter.getPrivateKey(info);
            }
        } catch (org.bouncycastle.openssl.PEMException e) {
            throw new IllegalArgumentException("Invalid PEM private key", e);
        }
        throw new IllegalArgumentException("PEM does not contain a private key");
    }

    private static RSAPublicKey parsePublicKey(String pem) {
        Object parsed = readPem(pem);
        try {
            if (parsed instanceof SubjectPublicKeyInfo info) {
                return (RSAPublicKey) new JcaPEMKeyConverter().getPublicKey(info);
            }
        } catch (org.bouncycastle.openssl.PEMException e) {
            throw new IllegalArgumentException("Invalid PEM public key", e);
        }
        throw new IllegalArgumentException("PEM does not contain a public key");
    }

    private static Object readPem(String pem) {
        try (PEMParser parser = new PEMParser(new StringReader(pem))) {
            Object parsed = parser.readObject();
            if (parsed == null) {
                throw new IllegalArgumentException("Invalid PEM key material");
            }
            return parsed;
        } catch (IOException e) {
            throw new IllegalArgumentException("Invalid PEM key material", e);
        }
    }
}
