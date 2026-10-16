package com.cakeplatform.api.modules.notification;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class NormalizedBroadcastPayload {
    String title;
    String message;
    String targetType;
    Long specificOwnerId;
    boolean sendEmail;
}
