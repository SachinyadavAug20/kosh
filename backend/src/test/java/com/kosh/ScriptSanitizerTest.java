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
    void testPatchPrimitiveConeAddRadius() {
        String input = "bpy.ops.mesh.primitive_cone_add(vertices=4, radius=1.0, depth=2.0, enter_editmode=False, align='WORLD', location=(0, 0, 1))";
        String patched = sanitizer.patchBlenderHallucinations(input);
        assertTrue(patched.contains("radius1=1.0"));
        assertFalse(patched.contains("radius=1.0"));
    }

    @Test
    void testTelemetryInjectionOnExport() {
        String input = "import bpy\nbpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')";
        String result = sanitizer.ensureTelemetryAndSnapshot(input);
        assertTrue(result.contains("KOSH WORKSTATION TELEMETRY"));
        assertTrue(result.contains("json.dump"));
        assertTrue(result.contains("numpy"));
        assertTrue(result.contains("bpy.ops.export_scene.gltf"));
    }

    @Test
    void testPatchUseNodesDeprecationFix() {
        String input = "    mat.use_nodes = True\n    mat_core.use_nodes = True";
        String patched = sanitizer.patchBlenderHallucinations(input);
        assertTrue(patched.contains("if hasattr(mat, \"use_nodes\") and not mat.use_nodes:"));
        assertTrue(patched.contains("if hasattr(mat_core, \"use_nodes\") and not mat_core.use_nodes:"));
    }
}
