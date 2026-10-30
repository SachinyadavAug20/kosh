package com.kosh.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ShareDto {
    private String id;
    private String title;
    private String description;
    private String author;
    private String assetUrl;
    private String assetName;
    private String snapshotUrl;
    private String script;
    private String format;
    private String theme;
    private Long createdAt;
    private String shareUrl;
    private List<Double> cameraPosition;
    private Map<String, Object> metadata;
}
