package com.meterhub.household.testsupport;

import org.springframework.core.env.MapPropertySource;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.Map;

/**
 * Generates an RSA key pair in memory for the test run and supplies the
 * public key as a PEM property. No key material is committed to source
 * control; every test JVM gets its own pair. The private key stays in memory
 * only, so tests can mint tokens the resource server accepts or rejects.
 */
public final class JwtTestKeys {

    private static final KeyPair KEY_PAIR = generate();

    private JwtTestKeys() {
    }

    /**
     * @return a property source with the PEM public key, highest precedence
     *         for the test environment. The Household Service never signs
     *         tokens, so it only consumes the public key.
     */
    public static MapPropertySource propertySource() {
        return new MapPropertySource("household-jwt-test-keys", Map.of(
            "identity.jwt.public-key", pemOf(KEY_PAIR.getPublic().getEncoded(), "PUBLIC KEY")
        ));
    }

    public static RSAPublicKey publicKey() {
        return (RSAPublicKey) KEY_PAIR.getPublic();
    }

    public static RSAPrivateKey privateKey() {
        return (RSAPrivateKey) KEY_PAIR.getPrivate();
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
