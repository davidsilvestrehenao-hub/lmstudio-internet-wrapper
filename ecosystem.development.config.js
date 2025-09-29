/* eslint-env node */
module.exports = {
  apps: [
    {
      name: "lmstudio-wrapper-dev",
      script: "bun",
      args: "run server.ts",
      cwd: "/Users/david/Documents/Projects/lmstudio-internet-wrapper",
      instances: 1,
      autorestart: true,
      watch: true,
      watch_delay: 1000,
      ignore_watch: [
        "node_modules",
        "logs",
        "*.log",
        ".git",
        "dist",
        "build",
        "coverage",
        "*.tsbuildinfo",
        ".DS_Store",
        ".vscode",
        ".idea",
      ],
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        WS_PORT: 3001,
        LM_STUDIO_URL: "http://localhost:1234",
        LOG_LEVEL: "debug",
        REQUEST_TIMEOUT: 30000,
        MAX_RETRIES: 3,
        OPENAPI_AUTO_OPEN: "true",
        SANDBOX_DIR: "./sandbox",
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 1000, // Higher limit for development
      },
      // PM2 specific configurations for development
      min_uptime: "5s",
      max_restarts: 5,
      restart_delay: 2000,
      kill_timeout: 3000,
      wait_ready: true,
      listen_timeout: 5000,

      // Logging configuration
      log_file: "./logs/combined-dev.log",
      out_file: "./logs/out-dev.log",
      error_file: "./logs/error-dev.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Advanced PM2 features
      merge_logs: true,
      time: true,

      // Health monitoring
      health_check_grace_period: 2000,
      health_check_fatal_exceptions: false, // More lenient for development

      // Process management
      exec_mode: "fork",
      node_args: ["--inspect"], // Enable debugging
    },
  ],
};
