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
        String patched = patchBlenderHallucinations(extracted);

        // 4. Ensure scene telemetry and snapshot logic is present when exporting
        return ensureTelemetryAndSnapshot(patched);
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
        patched = patched.replaceAll("\\bmath\\.Quaternion\\b", "mathutils.Quaternion");

        // Ensure mathutils import is present if Vector, Matrix, Euler, or Quaternion is referenced
        boolean referencesMathutils = patched.contains("mathutils") ||
                patched.contains("Vector(") ||
                patched.contains("Matrix(") ||
                patched.contains("Euler(") ||
                patched.contains("Quaternion(");

        if (referencesMathutils && !patched.contains("import mathutils")) {
            patched = "import mathutils\nfrom mathutils import Vector, Euler, Matrix, Quaternion\n" + patched;
        }

        // Ensure math import is present if math. is referenced
        if (patched.contains("math.") && !patched.contains("import math")) {
            patched = "import math\n" + patched;
        }

        // Context override safeguard: ensure active object exists before modifier apply
        if (patched.contains("bpy.ops.object.modifier_apply") && !patched.contains("bpy.context.view_layer.objects.active")) {
            patched = patched.replace("bpy.ops.object.modifier_apply",
                    "if bpy.context.view_layer.objects.active is None and bpy.context.selected_objects:\n" +
                    "    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]\n" +
                    "bpy.ops.object.modifier_apply");
        }

        // Fix primitive_cone_add: replace illegal 'radius=' with 'radius1='
        if (patched.contains("primitive_cone_add")) {
            Pattern conePattern = Pattern.compile("bpy\\.ops\\.mesh\\.primitive_cone_add\\(([\\s\\S]*?)\\)");
            Matcher matcher = conePattern.matcher(patched);
            StringBuilder sb = new StringBuilder();
            while (matcher.find()) {
                String args = matcher.group(1);
                if (!args.contains("radius1=") && args.contains("radius=")) {
                    args = args.replaceAll("\\bradius\\s*=", "radius1=");
                }
                matcher.appendReplacement(sb, Matcher.quoteReplacement("bpy.ops.mesh.primitive_cone_add(" + args + ")"));
            }
            matcher.appendTail(sb);
            patched = sb.toString();
        }

        return patched;
    }

    /**
     * Automatically appends telemetry and camera snapshot code if export statements exist
     */
    public String ensureTelemetryAndSnapshot(String script) {
        if (script == null) return "";
        if (script.contains("telemetry_path") || script.contains("\"telemetry\":")) {
            return script;
        }

        boolean hasExport = script.contains("export_scene.gltf") ||
                script.contains("wm.stl_export") ||
                script.contains("export_mesh.stl");

        if (!hasExport) {
            return script;
        }

        String telemetryBlock = """
            
            # --- KOSH WORKSTATION TELEMETRY & SNAPSHOT ---
            try:
                import os, json
                import mathutils
                from mathutils import Vector
                
                if bpy.context.view_layer.objects.active is None and bpy.context.selected_objects:
                    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
                
                argv = sys.argv
                _out = argv[argv.index("--") + 1] if "--" in argv else "output.glb"
                _bdir = os.path.dirname(_out)
                _bname = os.path.splitext(os.path.basename(_out))[0]
                _snap = os.path.join(_bdir, _bname + ".png")
                _telem = os.path.join(_bdir, _bname + ".json")
                
                _tot_verts = 0
                _tot_faces = 0
                _tot_edges = 0
                _dx, _dy, _dz = 0.0, 0.0, 0.0
                _mats = []
                _objs = []
                
                for _o in bpy.data.objects:
                    _objs.append(_o.name)
                    if _o.type == 'MESH' and _o.data:
                        _tot_verts += len(_o.data.vertices)
                        _tot_faces += len(_o.data.polygons)
                        _tot_edges += len(_o.data.edges)
                        _dx = max(_dx, _o.dimensions.x)
                        _dy = max(_dy, _o.dimensions.y)
                        _dz = max(_dz, _o.dimensions.z)
                        for _m in _o.data.materials:
                            if _m and _m.name not in _mats:
                                _mats.append(_m.name)
                
                with open(_telem, "w") as _tf:
                    json.dump({
                        "triangles": _tot_faces,
                        "vertices": _tot_verts,
                        "edges": _tot_edges,
                        "dimensions": [round(_dx, 3), round(_dy, 3), round(_dz, 3)],
                        "materials": _mats,
                        "objects": _objs
                    }, _tf)
                
                if not bpy.context.scene.camera:
                    _cdata = bpy.data.cameras.new("Kosh_Snapshot_Cam")
                    _cobj = bpy.data.objects.new("Kosh_Snapshot_Cam", _cdata)
                    bpy.context.scene.collection.objects.link(_cobj)
                    bpy.context.scene.camera = _cobj
                    _cobj.location = (4.5, -4.5, 3.5)
                    _dir = Vector((0, 0, 0.5)) - _cobj.location
                    _cobj.rotation_euler = _dir.to_track_quat('-Z', 'Y').to_euler()
                
                if not any(_o.type == 'LIGHT' for _o in bpy.data.objects):
                    _ldata = bpy.data.lights.new(name="Kosh_Sun", type='SUN')
                    _ldata.energy = 4.0
                    _lobj = bpy.data.objects.new("Kosh_Sun", _ldata)
                    bpy.context.scene.collection.objects.link(_lobj)
                    _lobj.location = (4, 4, 8)
                
                bpy.context.scene.render.image_settings.file_format = 'PNG'
                bpy.context.scene.render.filepath = _snap
                bpy.context.scene.render.resolution_x = 400
                bpy.context.scene.render.resolution_y = 300
                bpy.ops.render.render(write_still=True)
            except Exception:
                pass
            """;

        if (script.contains("bpy.ops.export_scene.gltf")) {
            return script.replace("bpy.ops.export_scene.gltf", telemetryBlock + "\n\nbpy.ops.export_scene.gltf");
        } else if (script.contains("bpy.ops.wm.stl_export")) {
            return script.replace("bpy.ops.wm.stl_export", telemetryBlock + "\n\nbpy.ops.wm.stl_export");
        } else if (script.contains("bpy.ops.export_mesh.stl")) {
            return script.replace("bpy.ops.export_mesh.stl", telemetryBlock + "\n\nbpy.ops.export_mesh.stl");
        }

        return script + "\n" + telemetryBlock;
    }
}
