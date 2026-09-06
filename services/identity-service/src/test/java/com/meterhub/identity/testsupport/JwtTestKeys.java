package com.meterhub.identity.testsupport;

import org.springframework.core.env.MapPropertySource;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.Map;

/**
 * Generates an RSA key pair in memory for the test run and supplies it as
 * PEM properties. No key material is committed to source control; every
 * test JVM gets its own pair.
 */
public final class JwtTestKeys {

    private static final KeyPair KEY_PAIR = generate();

    private JwtTestKeys() {
    }

    /**
     * @return a property source with the PEM keys, highest precedence for the
     *         test environment
     */
    public static MapPropertySource propertySource() {
        return new MapPropertySource("identity-jwt-test-keys", Map.of(
            "identity.jwt.private-key", pemOf(KEY_PAIR.getPrivate().getEncoded(), "PRIVATE KEY"),
            "identity.jwt.public-key", pemOf(KEY_PAIR.getPublic().getEncoded(), "PUBLIC KEY")
        ));
    }

    public static RSAPublicKey publicKey() {
        return (RSAPublicKey) KEY_PAIR.getPublic();
    }

    private static KeyPair generate() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String pemOf(byte[] encoded, String label) {
        String base64 = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(encoded);
        return "-----BEGIN " + label + "-----\n" + base64 + "\n-----END " + label + "-----\n";
    }
}
