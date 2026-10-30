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

    @Test
    void testPatchBlenderHallucinations() {
        String input = "direction = math.vector.Vector(look_at) - math.vector.Vector(loc)\nmat = math.Matrix.Identity(4)";
        String patched = sanitizer.patchBlenderHallucinations(input);
        assertTrue(patched.contains("mathutils.Vector(look_at)"));
        assertTrue(patched.contains("mathutils.Matrix.Identity(4)"));
        assertTrue(patched.contains("from mathutils import Vector"));
    }

    @Test
    void testTelemetryInjectionOnExport() {
        String input = "import bpy\nbpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')";
        String result = sanitizer.ensureTelemetryAndSnapshot(input);
        assertTrue(result.contains("KOSH WORKSTATION TELEMETRY"));
        assertTrue(result.contains("json.dump"));
        assertTrue(result.contains("bpy.ops.export_scene.gltf"));
    }
}
