"""
Kosh Blender Daemon - Warm Worker Process
Listens on local TCP socket for script execution requests.
Executes bpy scripts in memory and exports assets without cold-start overhead.
"""
import sys
import os
import io
import json
import socket
import struct
import time
import traceback
import bpy
import mathutils

DEFAULT_PORT = 9091
DEFAULT_HOST = "127.0.0.1"

def parse_args():
    port = DEFAULT_PORT
    host = DEFAULT_HOST
    argv = sys.argv
    if "--" in argv:
        args = argv[argv.index("--") + 1:]
        for i, a in enumerate(args):
            if a in ("--port", "-p") and i + 1 < len(args):
                port = int(args[i + 1])
            elif a in ("--host", "-h") and i + 1 < len(args):
                host = args[i + 1]
    return host, port

def reset_scene():
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    except Exception:
        for obj in list(bpy.data.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        for mesh in list(bpy.data.meshes):
            bpy.data.meshes.remove(mesh, do_unlink=True)
        for mat in list(bpy.data.materials):
            bpy.data.materials.remove(mat, do_unlink=True)
        for col in list(bpy.data.collections):
            bpy.data.collections.remove(col)
        for light in list(bpy.data.lights):
            bpy.data.lights.remove(light, do_unlink=True)
        for cam in list(bpy.data.cameras):
            bpy.data.cameras.remove(cam, do_unlink=True)

def compute_telemetry():
    tot_verts = 0
    tot_faces = 0
    tot_edges = 0
    dx, dy, dz = 0.0, 0.0, 0.0
    mats = []
    objs = []

    for o in bpy.data.objects:
        objs.append(o.name)
        if o.type == 'MESH' and o.data:
            tot_verts += len(o.data.vertices)
            tot_faces += len(o.data.polygons)
            tot_edges += len(o.data.edges)
            dx = max(dx, o.dimensions.x)
            dy = max(dy, o.dimensions.y)
            dz = max(dz, o.dimensions.z)
            for m in o.data.materials:
                if m and m.name not in mats:
                    mats.append(m.name)

    return {
        "triangles": tot_faces,
        "vertices": tot_verts,
        "edges": tot_edges,
        "dimensions": [round(dx, 3), round(dy, 3), round(dz, 3)],
        "materials": mats,
        "objects": objs
    }

def auto_export(output_path, fmt):
    ext = fmt.lower() if fmt else "glb"
    bdir = os.path.dirname(output_path)
    if bdir and not os.path.exists(bdir):
        os.makedirs(bdir, exist_ok=True)

    if ext == "blend" or output_path.lower().endswith(".blend"):
        bpy.ops.wm.save_as_mainfile(filepath=output_path)
    elif ext == "stl" or output_path.lower().endswith(".stl"):
        try:
            bpy.ops.wm.stl_export(filepath=output_path)
        except Exception:
            bpy.ops.export_mesh.stl(filepath=output_path)
    elif ext == "obj" or output_path.lower().endswith(".obj"):
        try:
            bpy.ops.wm.obj_export(filepath=output_path)
        except Exception:
            bpy.ops.export_scene.obj(filepath=output_path)
    elif ext == "fbx":
        bpy.ops.export_scene.fbx(filepath=output_path)
    elif ext in ("usd", "usdz"):
        bpy.ops.wm.usd_export(filepath=output_path)
    else:
        bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)

def execute_request(req):
    asset_id = req.get("assetId", "daemon_asset")
    script = req.get("script", "")
    fmt = req.get("format", "glb")
    output_path = req.get("outputPath", f"/tmp/kosh_{asset_id}.{fmt}")

    t0 = time.time()
    reset_scene()

    orig_argv = sys.argv[:]
    sys.argv = ["blender", "--", output_path]

    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = stdout_capture
    sys.stderr = stderr_capture

    success = False
    error_msg = None

    try:
        exec_globals = {
            "bpy": bpy,
            "mathutils": mathutils,
            "sys": sys,
            "os": os,
            "json": json,
            "time": time,
            "__file__": "kosh_script.py",
            "__name__": "__main__",
        }
        exec(script, exec_globals)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            auto_export(output_path, fmt)

        success = os.path.exists(output_path) and os.path.getsize(output_path) > 0
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        success = False
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        sys.argv = orig_argv

    exec_time_ms = int((time.time() - t0) * 1000)
    stdout_str = stdout_capture.getvalue()
    stderr_str = stderr_capture.getvalue()
    if error_msg:
        stderr_str = (stderr_str + "\n" + error_msg).strip()

    telemetry = {}
    size_bytes = 0
    if success and os.path.exists(output_path):
        size_bytes = os.path.getsize(output_path)
        try:
            telemetry = compute_telemetry()
            base_dir = os.path.dirname(output_path)
            base_name = os.path.splitext(os.path.basename(output_path))[0]
            telem_path = os.path.join(base_dir, base_name + ".json")
            with open(telem_path, "w") as tf:
                json.dump(telemetry, tf)
        except Exception:
            pass

    return {
        "success": success,
        "assetId": asset_id,
        "outputPath": output_path,
        "sizeBytes": size_bytes,
        "executionTimeMs": exec_time_ms,
        "stdout": stdout_str,
        "stderr": stderr_str,
        "telemetry": telemetry,
        "errorMessage": error_msg if not success else None
    }

def handle_client(sock):
    try:
        len_buf = sock.recv(4)
        if not len_buf or len(len_buf) < 4:
            return
        payload_len = struct.unpack(">I", len_buf)[0]
        
        chunks = []
        bytes_read = 0
        while bytes_read < payload_len:
            chunk = sock.recv(min(4096, payload_len - bytes_read))
            if not chunk:
                break
            chunks.append(chunk)
            bytes_read += len(chunk)
        
        payload = b"".join(chunks).decode("utf-8")
        req = json.loads(payload)

        if req.get("action") == "shutdown":
            res = {"success": True, "message": "Blender daemon shutting down"}
            res_bytes = json.dumps(res).encode("utf-8")
            sock.sendall(struct.pack(">I", len(res_bytes)) + res_bytes)
            sys.exit(0)

        if req.get("action") == "ping":
            res = {"success": True, "status": "warm", "version": bpy.app.version_string}
            res_bytes = json.dumps(res).encode("utf-8")
            sock.sendall(struct.pack(">I", len(res_bytes)) + res_bytes)
            return

        result = execute_request(req)
        res_bytes = json.dumps(result).encode("utf-8")
        sock.sendall(struct.pack(">I", len(res_bytes)) + res_bytes)
    except Exception as e:
        err = {"success": False, "errorMessage": str(e)}
        res_bytes = json.dumps(err).encode("utf-8")
        try:
            sock.sendall(struct.pack(">I", len(res_bytes)) + res_bytes)
        except Exception:
            pass
    finally:
        try:
            sock.close()
        except Exception:
            pass

def main():
    host, port = parse_args()
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((host, port))
    server.listen(16)
    print(f"KOSH_BLENDER_DAEMON_READY:{host}:{port}", flush=True)

    try:
        while True:
            client_sock, addr = server.accept()
            handle_client(client_sock)
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        server.close()

if __name__ == "__main__":
    main()
