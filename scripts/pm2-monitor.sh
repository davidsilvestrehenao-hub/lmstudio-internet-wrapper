#!/bin/bash

# PM2 Monitoring Script for LM Studio Wrapper
# This script provides monitoring and maintenance commands

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if PM2 is running
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 is not installed. Please install PM2 first."
        exit 1
    fi
}

# Function to check application status
check_status() {
    print_info "Checking application status..."
    pm2 status
}

# Function to show logs
show_logs() {
    print_info "Showing application logs (press Ctrl+C to exit)..."
    pm2 logs lmstudio-wrapper --lines 50
}

# Function to show real-time monitoring
show_monitor() {
    print_info "Opening PM2 monitoring dashboard..."
    pm2 monit
}

# Function to restart application
restart_app() {
    print_info "Restarting application..."
    pm2 restart lmstudio-wrapper
    print_status "Application restarted successfully"
}

# Function to reload application (zero-downtime)
reload_app() {
    print_info "Reloading application (zero-downtime)..."
    pm2 reload lmstudio-wrapper
    print_status "Application reloaded successfully"
}

# Function to stop application
stop_app() {
    print_info "Stopping application..."
    pm2 stop lmstudio-wrapper
    print_status "Application stopped"
}

# Function to start application
start_app() {
    print_info "Starting application..."
    pm2 start ecosystem.config.js --env production
    print_status "Application started"
}

# Function to show system information
show_system_info() {
    print_info "System Information:"
    echo "==================="
    echo "OS: $(uname -s)"
    echo "Architecture: $(uname -m)"
    echo "Uptime: $(uptime)"
    echo "Memory Usage:"
    free -h 2>/dev/null || vm_stat | grep -E "(free|active|inactive|wired)" | awk '{print $1, $2}'
    echo ""
    print_info "PM2 Process Information:"
    pm2 show lmstudio-wrapper
}

# Function to clean logs
clean_logs() {
    print_info "Cleaning old logs..."
    pm2 flush
    print_status "Logs cleaned successfully"
}

# Function to show help
show_help() {
    echo "PM2 Monitoring Script for LM Studio Wrapper"
    echo "==========================================="
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  status      - Show application status"
    echo "  logs        - Show application logs"
    echo "  monitor     - Open PM2 monitoring dashboard"
    echo "  restart     - Restart the application"
    echo "  reload      - Reload the application (zero-downtime)"
    echo "  stop        - Stop the application"
    echo "  start       - Start the application"
    echo "  info        - Show system and process information"
    echo "  clean       - Clean old logs"
    echo "  help        - Show this help message"
    echo ""
}

# Main script logic
main() {
    check_pm2
    
    case "${1:-status}" in
        "status")
            check_status
            ;;
        "logs")
            show_logs
            ;;
        "monitor")
            show_monitor
            ;;
        "restart")
            restart_app
            ;;
        "reload")
            reload_app
            ;;
        "stop")
            stop_app
            ;;
        "start")
            start_app
            ;;
        "info")
            show_system_info
            ;;
        "clean")
            clean_logs
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
