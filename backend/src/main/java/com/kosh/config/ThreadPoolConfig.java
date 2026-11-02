package com.kosh.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.CustomizableThreadFactory;

import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Bounded worker pool for MCP SSE request execution.
 * Replaces the unbounded cached thread pool so concurrent agent
 * requests cannot grow the JVM without limit.
 */
@Configuration
public class ThreadPoolConfig {

    @Bean(name = "mcpWorkerPool", destroyMethod = "shutdown")
    public ThreadPoolExecutor mcpWorkerPool() {
        return new ThreadPoolExecutor(
                4,
                8,
                60L,
                TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(100),
                new CustomizableThreadFactory("kosh-mcp-worker-"),
                new ThreadPoolExecutor.AbortPolicy()
        );
    }
}
