/* eslint-env node */
module.exports = {
  apps: [
    {
      name: "lmstudio-wrapper",
      script: "bun",
      args: "run server.ts",
      cwd: "/Users/david/Documents/Projects/lmstudio-internet-wrapper",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        WS_PORT: 3001,
        LM_STUDIO_URL: "http://localhost:1234",
        LOG_LEVEL: "info",
        REQUEST_TIMEOUT: 30000,
        MAX_RETRIES: 3,
        OPENAPI_AUTO_OPEN: "false",
        SANDBOX_DIR: "./sandbox",
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 100,
      },
      env_development: {
        NODE_ENV: "development",
        LOG_LEVEL: "debug",
        OPENAPI_AUTO_OPEN: "true",
      },
      env_production: {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
        OPENAPI_AUTO_OPEN: "false",
      },
      // PM2 specific configurations
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Logging configuration
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Advanced PM2 features
      merge_logs: true,
      time: true,

      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,

      // Process management
      exec_mode: "fork",
      node_args: [],

      // Environment variables for different deployments
      env_local: {
        NODE_ENV: "development",
        LM_STUDIO_URL: "http://localhost:1234",
        LOG_LEVEL: "debug",
      },
      env_staging: {
        NODE_ENV: "production",
        LM_STUDIO_URL: "http://staging-lmstudio:1234",
        LOG_LEVEL: "info",
      },
    },
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: "deploy",
      host: "your-server.com",
      ref: "origin/main",
      repo: "git@github.com:your-username/lmstudio-internet-wrapper.git",
      path: "/var/www/lmstudio-wrapper",
      "pre-deploy-local": "",
      "post-deploy":
        "bun install && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
    },
  },
};
