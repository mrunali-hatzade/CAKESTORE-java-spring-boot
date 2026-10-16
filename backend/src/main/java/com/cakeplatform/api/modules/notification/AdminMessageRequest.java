package com.cakeplatform.api.modules.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminMessageRequest {

    private UUID idempotencyKey;

    @NotBlank(message = "Title is required")
    @Size(min = 1, max = 255, message = "Title must be between 1 and 255 characters")
    private String title;

    @NotBlank(message = "Message is required")
    @Size(min = 1, max = 1024, message = "Message must be between 1 and 1024 characters")
    private String message;

    private String targetType; // "ALL" or "SPECIFIC"

    private Long specificOwnerId;

    private boolean sendEmail;
}
