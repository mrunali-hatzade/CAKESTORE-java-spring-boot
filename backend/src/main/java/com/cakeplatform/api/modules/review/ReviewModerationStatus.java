package com.cakeplatform.api.modules.review;

/**
 * Representation of product review moderation states.
 * - PUBLISHED: Active review visible on public storefront and included in product ratings.
 * - HIDDEN: Moderated review hidden by Super Admin (excluded from public storefront and ratings).
 */
public enum ReviewModerationStatus {
    PUBLISHED,
    HIDDEN
}

