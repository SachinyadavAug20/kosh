package com.kosh.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(
                    "https://kosh-puce.vercel.app",
                    "https://*.vercel.app",
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                    "http://localhost:8080"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD")
                .allowedHeaders("*")
                .exposedHeaders("X-BharatCode-Token", "X-BharatCode-Key", "Content-Disposition")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
