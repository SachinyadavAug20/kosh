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
        String extracted = null;

        // 1. Check if enclosed in markdown code fences
        Matcher matcher = CODE_BLOCK_PATTERN.matcher(trimmed);
        if (matcher.find()) {
            extracted = matcher.group(1).trim();
        }

        // 2. If no closed block found with regex, strip any stray ``` lines
        if (extracted == null || extracted.isEmpty()) {
            String[] lines = trimmed.split("\\r?\\n");
            StringBuilder sb = new StringBuilder();
            for (String line : lines) {
                String stripped = line.trim();
                if (stripped.startsWith("```")) {
                    continue;
                }
                sb.append(line).append("\n");
            }
            extracted = sb.toString().trim();
        }

        if (extracted.isEmpty()) {
            throw new IllegalArgumentException("Sanitized script resulted in empty code");
        }

        // 3. Auto-patch common LLM hallucinations in Blender Python
        return patchBlenderHallucinations(extracted);
    }

    /**
     * Auto-corrects common LLM hallucinations before running in Blender:
     * e.g., 'math.vector.Vector' -> 'mathutils.Vector'
     */
    public String patchBlenderHallucinations(String script) {
        if (script == null) return "";
        String patched = script;

        // Auto-correct non-existent 'math.vector' or 'math.Vector' -> 'mathutils.Vector'
        patched = patched.replaceAll("\\bmath\\.vector\\.Vector\\b", "mathutils.Vector");
        patched = patched.replaceAll("\\bmath\\.Vector\\b", "mathutils.Vector");
        patched = patched.replaceAll("\\bmath\\.vector\\b", "mathutils");
        patched = patched.replaceAll("\\bmath\\.matrix\\.Matrix\\b", "mathutils.Matrix");
        patched = patched.replaceAll("\\bmath\\.Matrix\\b", "mathutils.Matrix");
        patched = patched.replaceAll("\\bmath\\.euler\\.Euler\\b", "mathutils.Euler");
        patched = patched.replaceAll("\\bmath\\.Euler\\b", "mathutils.Euler");
        patched = patched.replaceAll("\\bmath\\.quaternion\\.Quaternion\\b", "mathutils.Quaternion");

        // Ensure mathutils import is present if Vector, Matrix, Euler, or mathutils is referenced
        boolean referencesMathutils = patched.contains("mathutils") ||
                patched.contains("Vector(") ||
                patched.contains("Matrix(") ||
                patched.contains("Euler(") ||
                patched.contains("Quaternion(");

        if (referencesMathutils && !patched.contains("import mathutils")) {
            patched = "import mathutils\nfrom mathutils import Vector, Matrix, Euler, Quaternion\n" + patched;
        }

        // Ensure math import is present if math. is referenced
        if (patched.contains("math.") && !patched.contains("import math")) {
            patched = "import math\n" + patched;
        }

        return patched;
    }
}
