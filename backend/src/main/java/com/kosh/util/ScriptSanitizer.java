package com.kosh.util;

import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ScriptSanitizer {

    private static final Pattern CODE_BLOCK_PATTERN = Pattern.compile(
            "```(?:python|py)?\\s*\\n([\\s\\S]*?)\\n```",
            Pattern.CASE_INSENSITIVE
    );

    /**
     * Sanitizes raw LLM output, extracting pure Python script and stripping markdown fences.
     *
     * @param rawText Raw output from LLM
     * @return Clean Python script ready for Blender headless execution
     */
    public String sanitize(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            throw new IllegalArgumentException("Script content is empty or null");
        }

        String trimmed = rawText.trim();

        // 1. Check if enclosed in markdown code fences
        Matcher matcher = CODE_BLOCK_PATTERN.matcher(trimmed);
        if (matcher.find()) {
            String extracted = matcher.group(1).trim();
            if (!extracted.isEmpty()) {
                return extracted;
            }
        }

        // 2. If no closed block found with regex, strip any stray ``` lines
        String[] lines = trimmed.split("\\r?\\n");
        StringBuilder sb = new StringBuilder();
        boolean inBlock = false;

        for (String line : lines) {
            String stripped = line.trim();
            if (stripped.startsWith("```")) {
                inBlock = !inBlock;
                continue;
            }
            sb.append(line).append("\n");
        }

        String result = sb.toString().trim();
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Sanitized script resulted in empty code");
        }

        return result;
    }
}
