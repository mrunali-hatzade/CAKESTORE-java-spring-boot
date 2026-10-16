package com.cakeplatform.api.modules.notification;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class CanonicalPayloadHasherTest {

    @Test
    @DisplayName("Identical payloads with different whitespace or line endings produce identical hashes")
    void testDeterministicHashNormalization() {
        NormalizedBroadcastPayload p1 = NormalizedBroadcastPayload.builder()
                .title("Special Discount")
                .message("Hello all shop owners.\nPrepare your stock.")
                .targetType("ALL")
                .specificOwnerId(null)
                .sendEmail(true)
                .build();

        NormalizedBroadcastPayload p2 = NormalizedBroadcastPayload.builder()
                .title("Special Discount")
                .message("Hello all shop owners.\nPrepare your stock.")
                .targetType("ALL")
                .specificOwnerId(null)
                .sendEmail(true)
                .build();

        String hash1 = CanonicalPayloadHasher.computeHash(p1);
        String hash2 = CanonicalPayloadHasher.computeHash(p2);

        assertNotNull(hash1);
        assertEquals(64, hash1.length());
        assertEquals(hash1, hash2, "Deterministic canonical hashes must match exactly");
    }

    @Test
    @DisplayName("Different payload parameters produce different hashes")
    void testHashMismatchOnParameterChange() {
        NormalizedBroadcastPayload p1 = NormalizedBroadcastPayload.builder()
                .title("Special Discount")
                .message("Hello all shop owners.\nPrepare your stock.")
                .targetType("ALL")
                .specificOwnerId(null)
                .sendEmail(true)
                .build();

        NormalizedBroadcastPayload p2 = NormalizedBroadcastPayload.builder()
                .title("Special Discount")
                .message("Hello all shop owners.\nPrepare your stock.")
                .targetType("ALL")
                .specificOwnerId(null)
                .sendEmail(false) // Changed
                .build();

        String hash1 = CanonicalPayloadHasher.computeHash(p1);
        String hash2 = CanonicalPayloadHasher.computeHash(p2);

        assertNotEquals(hash1, hash2, "Payloads differing in sendEmail must produce different hashes");
    }
}
