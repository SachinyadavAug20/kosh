"use client";

import React, { useState } from "react";
import { Terminal, Play, X, Sparkles, Check, FileCode, AlertCircle } from "lucide-react";

interface PasteBpyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (script: string) => void;
  isLoading?: boolean;
}

const PRESET_SCRIPTS = [
  {
    name: "Suzanne the Monkey (Subdivided Gold)",
    script: `import bpy, sys, math
argv = sys.argv
output_path = argv[argv.index("--") + 1] if "--" in argv else "output.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_monkey_add(size=2.0, location=(0, 0, 1.2))
suz = bpy.context.active_object
suz.name = "Suzanne_Hero"

sub = suz.modifiers.new("Subsurf", type='SUBSURF')
sub.levels = 2
bpy.ops.object.shade_smooth()

mat = bpy.data.materials.new("Mat_BurnishedGold")
mat.use_nodes = True
b = mat.node_tree.nodes.get("Principled BSDF")
if b:
    b.inputs["Base Color"].default_value = (0.95, 0.75, 0.2, 1.0)
    b.inputs["Metallic"].default_value = 0.95
    b.inputs["Roughness"].default_value = 0.18
suz.data.materials.append(mat)

klight = bpy.data.lights.new("Key", type='AREA')
klight.energy = 950
kobj = bpy.data.objects.new("Key", klight)
bpy.context.collection.objects.link(kobj)
kobj.location = (4, 4, 5)

bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
`
  },
  {
    name: "Voronoi Wire Torus (Procedural Lattice)",
    script: `import bpy, sys, math
argv = sys.argv
output_path = argv[argv.index("--") + 1] if "--" in argv else "output.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_torus_add(major_radius=1.8, minor_radius=0.7, major_segments=36, minor_segments=16, location=(0, 0, 1.0))
torus = bpy.context.active_object
torus.name = "Voronoi_Torus"

wire = torus.modifiers.new("Wireframe", type='WIREFRAME')
wire.thickness = 0.04
wire.use_replace = True

sub = torus.modifiers.new("Subsurf", type='SUBSURF')
sub.levels = 1

mat = bpy.data.materials.new("Mat_NeonCyan")
mat.use_nodes = True
b = mat.node_tree.nodes.get("Principled BSDF")
if b:
    b.inputs["Base Color"].default_value = (0.05, 0.75, 0.95, 1.0)
    b.inputs["Metallic"].default_value = 0.8
    b.inputs["Roughness"].default_value = 0.2
torus.data.materials.append(mat)

klight = bpy.data.lights.new("Key", type='AREA')
klight.energy = 1000
kobj = bpy.data.objects.new("Key", klight)
bpy.context.collection.objects.link(kobj)
kobj.location = (4, 4, 5)

bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
`
  },
  {
    name: "Golden Fibonacci Spiral (Kinetic Ribs)",
    script: `import bpy, sys, math
argv = sys.argv
output_path = argv[argv.index("--") + 1] if "--" in argv else "output.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
num_ribs = 32
for i in range(num_ribs):
    t = i / num_ribs
    theta = i * 0.4
    r = 0.3 + 1.8 * t
    x = r * math.cos(theta)
    y = r * math.sin(theta)
    z = t * 2.5
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z))
    c = bpy.context.active_object
    c.name = f"Spiral_Rib_{i+1:02d}"
    c.scale = (0.2 + 0.3 * t, 0.08, 0.08)
    c.rotation_euler = (0, 0, theta + math.pi/2)

klight = bpy.data.lights.new("Key", type='AREA')
klight.energy = 900
kobj = bpy.data.objects.new("Key", klight)
bpy.context.collection.objects.link(kobj)
kobj.location = (4, 4, 6)

bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
`
  }
];

export function PasteBpyModal({
  isOpen,
  onClose,
  onExecute,
  isLoading = false,
}: PasteBpyModalProps) {
  const [scriptText, setScriptText] = useState("");
  const [copiedPreset, setCopiedPreset] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (presetScript: string, presetName: string) => {
    setScriptText(presetScript);
    setCopiedPreset(presetName);
    setTimeout(() => setCopiedPreset(null), 2000);
  };

  const handleRun = () => {
    if (!scriptText.trim()) return;
    onExecute(scriptText.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#1a1a1e] border border-[#333338] w-full max-w-4xl rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-xs font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333338] bg-[#202024]">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-[#ea580c]" />
            <span className="font-semibold text-sm text-[#f4f4f5]">Paste Blender Python Script (`bpy`)</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#141416] border border-[#333338] text-[#a1a1aa] rounded">
              HEADLESS 5.2 INGESTION
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#2c2c32] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Guidance & Presets Bar */}
        <div className="px-4 py-2 bg-[#18181b] border-b border-[#333338] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 text-[#a1a1aa] text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[#ea580c]" />
            <span>Paste code copied from desktop Blender's Scripting workspace. Auto-compiled to GLB in &lt;2s.</span>
          </div>

          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-[#71717a] font-mono uppercase mr-1">Presets:</span>
            {PRESET_SCRIPTS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p.script, p.name)}
                className="px-2 py-1 bg-[#202024] hover:bg-[#2c2c32] border border-[#383840] rounded text-[10px] text-[#d4d4d8] transition-colors"
              >
                {copiedPreset === p.name ? "Applied!" : p.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Script Editor Body */}
        <div className="flex-1 min-h-[340px] p-2 bg-[#141416] overflow-hidden flex flex-col">
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder={`# Paste your raw Blender Python script here...
import bpy, sys, math

argv = sys.argv
output_path = argv[argv.index("--") + 1] if "--" in argv else "output.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
# ... your procedural geometry, lighting, materials

bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
`}
            className="w-full flex-1 bg-transparent text-[#e4e4e7] font-mono text-[11px] leading-relaxed p-3 focus:outline-none resize-none selection:bg-[#ea580c]/30"
            spellCheck={false}
          />
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-[#202024] border-t border-[#333338] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[11px] text-[#71717a]">
            <span>{scriptText ? scriptText.split("\n").length : 0} lines</span>
            <span>•</span>
            <span>Direct Headless Execution</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#383840] rounded text-xs text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleRun}
              disabled={isLoading || !scriptText.trim()}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#ea580c] hover:bg-[#f97316] disabled:opacity-50 text-white font-semibold rounded text-xs shadow-md transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isLoading ? "Executing in Blender..." : "Run in Headless Blender"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
