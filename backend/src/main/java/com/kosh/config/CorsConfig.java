package com.kosh.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("https://kosh-puce.vercel.app")   // was: allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD")
                .allowedHeaders("*")
                .exposedHeaders("X-BharatCode-Token", "X-BharatCode-Key", "Content-Disposition")
                .allowCredentials(true)                           // was: false
                .maxAge(3600);
    }
}
