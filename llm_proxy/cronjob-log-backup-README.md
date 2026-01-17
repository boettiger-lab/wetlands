# Log Backup CronJob

This CronJob automatically backs up llm-proxy logs to S3 storage.

## Features

- Runs daily at 2 AM UTC
- Fetches logs from all llm-proxy pods
- Creates unified log file with timestamp
- Uploads to S3 using rclone
- Keeps individual pod logs organized by date

## Prerequisites

The `rclone-config` secret must exist in the biodiversity namespace with your rclone configuration.

## Deploy

```bash
# Deploy the CronJob (runs automatically at 2 AM daily)
kubectl apply -f llm_proxy/cronjob-log-backup.yaml

# Verify CronJob is scheduled
kubectl get cronjob -n biodiversity llm-proxy-log-backup

# Check the schedule
kubectl describe cronjob -n biodiversity llm-proxy-log-backup
```

## Manual Test Run

The manifest includes a one-time Job for immediate testing:

```bash
# Run a manual backup right now
kubectl apply -f llm_proxy/cronjob-log-backup.yaml

# Watch the job progress
kubectl get jobs -n biodiversity -w

# View logs from the manual backup
kubectl logs -n biodiversity job/llm-proxy-log-backup-manual -f

# Clean up manual job after testing
kubectl delete job -n biodiversity llm-proxy-log-backup-manual
```

## S3 Storage Structure

Logs are uploaded to `nrp:logs-wetlands/` with the following structure:

```
logs-wetlands/
├── llm-proxy-unified_20260107_020000.log  # Daily unified logs
├── llm-proxy-unified_20260108_020000.log
├── 20260107_020000/                        # Individual pod logs (optional)
│   ├── llm-proxy-685c7df495-5xvpm_20260107_020000.log
│   └── llm-proxy-685c7df495-pjzzk_20260107_020000.log
└── 20260108_020000/
    └── ...
```

## Analyzing Backups

Download and analyze logs from S3:

```bash
# List available logs
rclone ls nrp:logs-wetlands/

# Download a specific unified log
rclone copy nrp:logs-wetlands/llm-proxy-unified_20260107_020000.log logs/

# Download all logs
rclone copy nrp:logs-wetlands/ logs/s3-backups/

# Analyze
python llm_proxy/analyze_logs.py logs/llm-proxy-unified_20260107_020000.log
```

## Configuration

### Change Schedule

Edit the cron schedule in the manifest (currently `0 2 * * *` = 2 AM daily):

- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight
- `0 2 1 * *` - Monthly on the 1st at 2 AM

### Retention

The CronJob keeps:
- Last 3 successful job runs
- Last 3 failed job runs

Older job history is automatically cleaned up by Kubernetes.

For S3 retention, configure lifecycle policies on the bucket separately.

## Troubleshooting

```bash
# Check CronJob status
kubectl get cronjob -n biodiversity

# View recent job runs
kubectl get jobs -n biodiversity -l job-name=llm-proxy-log-backup

# Check logs from last run
kubectl logs -n biodiversity -l job-name=llm-proxy-log-backup --tail=100

# Verify rclone config is mounted
kubectl describe cronjob -n biodiversity llm-proxy-log-backup
```

## Monitoring

Check if backups are running:

```bash
# See when the next backup will run
kubectl get cronjob -n biodiversity llm-proxy-log-backup -o jsonpath='{.status.lastScheduleTime}'

# Check if any backups failed
kubectl get jobs -n biodiversity -l job-name=llm-proxy-log-backup --field-selector status.successful=0
```
