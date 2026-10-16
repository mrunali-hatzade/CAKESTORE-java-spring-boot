package com.cakeplatform.api.modules.notification;

import com.fasterxml.jackson.core.JsonEncoding;
import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class CanonicalPayloadHasher {

    private static final JsonFactory JSON_FACTORY = new JsonFactory();

    public static String computeHash(NormalizedBroadcastPayload payload) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (JsonGenerator gen = JSON_FACTORY.createGenerator(baos, JsonEncoding.UTF8)) {
                gen.writeStartObject();
                // Strictly ordered field 1: message (normalized LF, trimmed)
                gen.writeStringField("message", payload.getMessage());
                // Strictly ordered field 2: sendEmail (boolean literal)
                gen.writeBooleanField("sendEmail", payload.isSendEmail());
                // Strictly ordered field 3: specificOwnerId (integer or null literal)
                if (payload.getSpecificOwnerId() != null) {
                    gen.writeNumberField("specificOwnerId", payload.getSpecificOwnerId());
                } else {
                    gen.writeNullField("specificOwnerId");
                }
                // Strictly ordered field 4: targetType ("ALL" or "SPECIFIC")
                gen.writeStringField("targetType", payload.getTargetType());
                // Strictly ordered field 5: title (trimmed)
                gen.writeStringField("title", payload.getTitle());
                gen.writeEndObject();
            }
            return sha256Hex(baos.toByteArray());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute canonical payload hash", e);
        }
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
