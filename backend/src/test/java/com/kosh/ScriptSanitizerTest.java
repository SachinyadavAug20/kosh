package com.kosh;

import com.kosh.util.ScriptSanitizer;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ScriptSanitizerTest {

    private final ScriptSanitizer sanitizer = new ScriptSanitizer();

    @Test
    void testSanitizeWithMarkdownPythonBlock() {
        String input = """
                Here is the requested script:
                ```python
                import bpy
                bpy.ops.mesh.primitive_cube_add()
                ```
                Enjoy your 3D cube!
                """;

        String result = sanitizer.sanitize(input);
        assertEquals("import bpy\nbpy.ops.mesh.primitive_cube_add()", result);
    }

    @Test
    void testSanitizeWithBareFences() {
        String input = """
                ```
                import bpy
                bpy.ops.mesh.primitive_cylinder_add()
                ```
                """;

        String result = sanitizer.sanitize(input);
        assertEquals("import bpy\nbpy.ops.mesh.primitive_cylinder_add()", result);
    }

    @Test
    void testSanitizePlainCode() {
        String input = "import bpy\nbpy.ops.object.select_all()";
        String result = sanitizer.sanitize(input);
        assertEquals("import bpy\nbpy.ops.object.select_all()", result);
    }

    @Test
    void testSanitizeEmptyThrows() {
        assertThrows(IllegalArgumentException.class, () -> sanitizer.sanitize("   "));
    }
}
