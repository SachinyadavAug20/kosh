package com.kosh.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

public class ToolExecutionDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Request {
        private String toolName;
        private String prompt;
        private String script;
        private String exportFormat; // glb, stl
        private Map<String, Object> parameters;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Result {
        private boolean success;
        private String toolName;
        private String assetId;
        private String assetName;
        private String assetUrl;
        private String snapshotUrl;
        private Map<String, Object> telemetry;
        private String format;
        private long sizeBytes;
        private String script;
        private String stdout;
        private String stderr;
        private int exitCode;
        private long executionTimeMs;
        private String errorMessage;
    }
}
