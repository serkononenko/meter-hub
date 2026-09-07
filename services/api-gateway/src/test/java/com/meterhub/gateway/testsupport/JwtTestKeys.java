package com.meterhub.gateway.testsupport;

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
 * In-memory RSA key pair for JWT tests.
 *
 * <p>The generated keys exist only for the life of the test JVM: no key
 * material is committed to source control. The private key is never used by
 * the gateway itself; tests need it to sign tokens the way the identity
 * service would.
 */
public final class JwtTestKeys {

    private static final KeyPair KEY_PAIR = generate();

    private JwtTestKeys() {
    }

    /**
     * Property source supplying the public key exactly the way a
     * {@code configtree} would deliver it in production.
     */
    public static MapPropertySource propertySource() {
        return new MapPropertySource("gateway-jwt-test-keys", Map.of(
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
