/* eslint-env node */
module.exports = {
  apps: [
    {
      name: "lmstudio-wrapper-prod",
      script: "bun",
      args: "run server.ts",
      cwd: "/Users/david/Documents/Projects/lmstudio-internet-wrapper",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        WS_PORT: 3001,
        LM_STUDIO_URL: "http://localhost:1234",
        LOG_LEVEL: "info",
        REQUEST_TIMEOUT: 30000,
        MAX_RETRIES: 5,
        OPENAPI_AUTO_OPEN: "false",
        SANDBOX_DIR: "./sandbox",
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 100,
      },
      // PM2 specific configurations for production
      min_uptime: "30s",
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 15000,

      // Logging configuration
      log_file: "./logs/combined-prod.log",
      out_file: "./logs/out-prod.log",
      error_file: "./logs/error-prod.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Advanced PM2 features
      merge_logs: true,
      time: true,

      // Health monitoring
      health_check_grace_period: 5000,
      health_check_fatal_exceptions: true,

      // Process management
      exec_mode: "fork",
      node_args: [],

      // Production optimizations
      exp_backoff_restart_delay: 100,

      // Log rotation
      log_type: "json",

      // Environment variables for different production scenarios
      env_staging: {
        NODE_ENV: "production",
        LM_STUDIO_URL: "http://staging-lmstudio:1234",
        LOG_LEVEL: "debug",
        RATE_LIMIT_MAX: 200,
      },
      env_production: {
        NODE_ENV: "production",
        LM_STUDIO_URL: "http://localhost:1234",
        LOG_LEVEL: "info",
        RATE_LIMIT_MAX: 100,
      },
    },
  ],

  // Deployment configuration for production
  deploy: {
    production: {
      user: "deploy",
      host: "your-production-server.com",
      ref: "origin/main",
      repo: "git@github.com:your-username/lmstudio-internet-wrapper.git",
      path: "/var/www/lmstudio-wrapper",
      "pre-deploy-local": "",
      "post-deploy":
        "bun install && pm2 reload ecosystem.production.config.js --env production",
      "pre-setup": "",
    },
    staging: {
      user: "deploy",
      host: "your-staging-server.com",
      ref: "origin/develop",
      repo: "git@github.com:your-username/lmstudio-internet-wrapper.git",
      path: "/var/www/lmstudio-wrapper-staging",
      "pre-deploy-local": "",
      "post-deploy":
        "bun install && pm2 reload ecosystem.production.config.js --env staging",
      "pre-setup": "",
    },
  },
};
