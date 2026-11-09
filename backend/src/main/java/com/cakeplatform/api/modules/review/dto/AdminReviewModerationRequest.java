package com.cakeplatform.api.modules.review.dto;

import com.cakeplatform.api.modules.review.ReviewModerationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminReviewModerationRequest {

    @NotNull(message = "Moderation status is required (PUBLISHED or HIDDEN)")
    private ReviewModerationStatus status;

    @Size(max = 500, message = "Moderation reason cannot exceed 500 characters")
    private String reason;
}
