package com.kosh.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.stream.Stream;

/**
 * Prunes transient execution artifacts (Blender scratch scripts and
 * generated model exports) from the storage root so long-running
 * instances do not accumulate unbounded disk usage.
 *
 * Only files directly under the storage root are considered:
 * script_*.py (scratch Blender scripts) and kosh_* (generated
 * exports). Subdirectories such as shares/ and static resources
 * such as blender_daemon.py are never touched.
 */
@Slf4j
@Service
public class StorageCleanupService {

    private static final Duration MAX_AGE = Duration.ofMinutes(15);

    @Value("${app.storage.dir:storage}")
    private String storageDirProperty;

    @Scheduled(fixedRateString = "300000")
    public void pruneExpiredArtifacts() {
        Path root = Paths.get(storageDirProperty).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            return;
        }

        Instant cutoff = Instant.now().minus(MAX_AGE);
        int pruned = 0;

        try (Stream<Path> entries = Files.list(root)) {
            for (Path file : (Iterable<Path>) entries::iterator) {
                if (!Files.isRegularFile(file)) {
                    continue;
                }
                String name = file.getFileName().toString();
                boolean isScratchScript = name.startsWith("script_") && name.endsWith(".py");
                boolean isGeneratedExport = name.startsWith("kosh_");
                if (!isScratchScript && !isGeneratedExport) {
                    continue;
                }
                try {
                    if (Files.getLastModifiedTime(file).toInstant().isBefore(cutoff)) {
                        if (Files.deleteIfExists(file)) {
                            pruned++;
                            log.debug("Pruned expired storage artifact: {}", name);
                        }
                    }
                } catch (IOException e) {
                    log.debug("Could not prune {}: {}", name, e.getMessage());
                }
            }
        } catch (IOException e) {
            log.warn("Storage prune scan failed for {}: {}", root, e.getMessage());
        }

        if (pruned > 0) {
            log.info("Storage cleanup removed {} expired artifact(s) older than {} minutes",
                    pruned, MAX_AGE.toMinutes());
        }
    }
}
