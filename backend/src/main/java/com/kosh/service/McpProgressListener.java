package com.kosh.service;

/**
 * Listener interface for streaming JSON-RPC notifications/progress updates
 * during long-running 3D CAD modeling and Blender operations.
 */
@FunctionalInterface
public interface McpProgressListener {

    /**
     * Called when an intermediate progress milestone is reached.
     *
     * @param progressToken Token identifying the client progress stream
     * @param progress Progress fraction (0.0 to 1.0)
     * @param total Total progress reference (typically 1.0)
     * @param message Human-readable status description of current stage
     */
    void onProgress(String progressToken, double progress, double total, String message);
}
