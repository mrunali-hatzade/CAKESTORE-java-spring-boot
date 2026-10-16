package com.cakeplatform.api.modules.notification;

import org.springframework.context.ApplicationEvent;

public class BroadcastCommittedEvent extends ApplicationEvent {

    public BroadcastCommittedEvent(Long broadcastId) {
        super(broadcastId);
    }

    public Long getBroadcastId() {
        return (Long) getSource();
    }
}
