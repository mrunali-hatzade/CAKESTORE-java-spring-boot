package com.cakeplatform.api.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private FileStorageProperties fileStorageProperties;

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:3001,http://localhost:3002}")
    private String allowedOriginsConfig;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadDir = Paths.get(fileStorageProperties.getUploadDir()).toAbsolutePath().normalize();
        String baseUri = uploadDir.toUri().toString();
        if (!baseUri.endsWith("/")) {
            baseUri += "/";
        }

        // Only register static resource handlers for public media assets.
        // Private compliance documents (documents, verifications) are intentionally excluded
        // and served exclusively via authenticated, signed endpoints.
        String[] publicCategories = {"products", "covers", "logos", "review-media", "custom-cake-references"};
        for (String category : publicCategories) {
            registry.addResourceHandler("/uploads/" + category + "/**")
                    .addResourceLocations(baseUri + category + "/");
        }
    }

    // CORS is handled by SecurityConfig.java
    // public void addCorsMappings(CorsRegistry registry) { ... }
}
