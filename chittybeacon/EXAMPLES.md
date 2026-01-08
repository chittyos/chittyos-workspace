# ChittyBeacon API Examples

## Basic Usage

### Check Beacon Health

```bash
curl https://beacon.chitty.cc/health
```

Response:
```json
{
  "status": "healthy",
  "service": "ChittyBeacon",
  "timestamp": "2026-01-08T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Get Overall Ecosystem Status

```bash
curl https://beacon.chitty.cc/status
```

Response:
```json
{
  "overall": "healthy",
  "timestamp": "2026-01-08T12:00:00.000Z",
  "services": [
    {
      "service": "Schema Service",
      "url": "https://schema.chitty.cc",
      "currentStatus": "healthy",
      "lastCheck": "2026-01-08T11:55:00.000Z",
      "responseTime": 145,
      "uptime24h": 99.8,
      "recentChecks": [...]
    },
    ...
  ],
  "summary": {
    "total": 11,
    "healthy": 10,
    "degraded": 1,
    "unhealthy": 0
  }
}
```

### Get Specific Service Status

```bash
# Schema service
curl https://beacon.chitty.cc/status/schema

# Auth service
curl https://beacon.chitty.cc/status/auth

# API service
curl https://beacon.chitty.cc/status/api
```

Response:
```json
{
  "service": "Schema Service",
  "url": "https://schema.chitty.cc",
  "currentStatus": "healthy",
  "lastCheck": "2026-01-08T11:55:00.000Z",
  "responseTime": 145,
  "uptime24h": 99.8,
  "recentChecks": [
    {
      "service": "Schema Service",
      "url": "https://schema.chitty.cc",
      "status": "healthy",
      "statusCode": 200,
      "responseTime": 145,
      "timestamp": "2026-01-08T11:55:00.000Z"
    },
    ...
  ]
}
```

### Trigger Health Check

```bash
curl -X POST https://beacon.chitty.cc/check
```

Response:
```json
{
  "timestamp": "2026-01-08T12:00:00.000Z",
  "summary": {
    "total": 11,
    "healthy": 10,
    "degraded": 1,
    "unhealthy": 0
  },
  "results": [
    {
      "service": "Schema Service",
      "url": "https://schema.chitty.cc",
      "status": "healthy",
      "statusCode": 200,
      "responseTime": 145,
      "timestamp": "2026-01-08T12:00:00.000Z"
    },
    ...
  ]
}
```

## Advanced Usage

### Pretty Print JSON

```bash
curl https://beacon.chitty.cc/status | jq
```

### Get Only Summary

```bash
curl https://beacon.chitty.cc/status | jq '.summary'
```

Output:
```json
{
  "total": 11,
  "healthy": 10,
  "degraded": 1,
  "unhealthy": 0
}
```

### List All Unhealthy Services

```bash
curl https://beacon.chitty.cc/status | jq '.services[] | select(.currentStatus == "unhealthy")'
```

### Get All Services with Response Time > 1000ms

```bash
curl https://beacon.chitty.cc/status | jq '.services[] | select(.responseTime > 1000)'
```

### Get Service Names and Status

```bash
curl https://beacon.chitty.cc/status | jq '.services[] | {service, status: .currentStatus}'
```

Output:
```json
{"service": "Schema Service", "status": "healthy"}
{"service": "Identity Service", "status": "healthy"}
{"service": "Auth Service", "status": "degraded"}
...
```

### Monitor Specific Service Over Time

```bash
# Check every 30 seconds
watch -n 30 'curl -s https://beacon.chitty.cc/status/schema | jq "{status: .currentStatus, responseTime, uptime24h}"'
```

### Get Uptime for All Services

```bash
curl https://beacon.chitty.cc/status | jq '.services[] | {service, uptime: .uptime24h}'
```

## Integration Examples

### JavaScript/TypeScript

```typescript
// Fetch ecosystem status
async function getEcosystemStatus() {
  const response = await fetch('https://beacon.chitty.cc/status');
  const data = await response.json();
  return data;
}

// Check if all services are healthy
async function areAllServicesHealthy() {
  const status = await getEcosystemStatus();
  return status.overall === 'healthy';
}

// Get unhealthy services
async function getUnhealthyServices() {
  const status = await getEcosystemStatus();
  return status.services.filter(s => s.currentStatus === 'unhealthy');
}

// Trigger health check
async function triggerHealthCheck() {
  const response = await fetch('https://beacon.chitty.cc/check', {
    method: 'POST'
  });
  return response.json();
}
```

### Python

```python
import requests

def get_ecosystem_status():
    response = requests.get('https://beacon.chitty.cc/status')
    return response.json()

def are_all_services_healthy():
    status = get_ecosystem_status()
    return status['overall'] == 'healthy'

def get_unhealthy_services():
    status = get_ecosystem_status()
    return [s for s in status['services'] if s['currentStatus'] == 'unhealthy']

def trigger_health_check():
    response = requests.post('https://beacon.chitty.cc/check')
    return response.json()
```

### Shell Script

```bash
#!/bin/bash

# Check if ecosystem is healthy
check_health() {
  STATUS=$(curl -s https://beacon.chitty.cc/status | jq -r '.overall')
  if [ "$STATUS" = "healthy" ]; then
    echo "All systems operational"
    return 0
  else
    echo "System degraded or unhealthy"
    return 1
  fi
}

# Alert if any service is down
alert_if_down() {
  UNHEALTHY=$(curl -s https://beacon.chitty.cc/status | jq '.services[] | select(.currentStatus == "unhealthy") | .service')
  if [ -n "$UNHEALTHY" ]; then
    echo "Alert: Services down:"
    echo "$UNHEALTHY"
    # Send notification (e.g., email, Slack, etc.)
  fi
}

# Run checks
check_health
alert_if_down
```

### React Component

```tsx
import { useEffect, useState } from 'react';

interface ServiceStatus {
  service: string;
  currentStatus: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  uptime24h: number;
}

interface EcosystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceStatus[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export function StatusDashboard() {
  const [status, setStatus] = useState<EcosystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('https://beacon.chitty.cc/status');
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!status) return <div>Error loading status</div>;

  return (
    <div>
      <h1>Chitty Ecosystem Status</h1>
      <div className={`status-${status.overall}`}>
        Overall: {status.overall}
      </div>
      <div>
        {status.services.map(service => (
          <div key={service.service} className={`service-${service.currentStatus}`}>
            <h3>{service.service}</h3>
            <p>Status: {service.currentStatus}</p>
            <p>Response Time: {service.responseTime}ms</p>
            <p>Uptime (24h): {service.uptime24h.toFixed(2)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Monitoring and Alerting

### Prometheus Metrics

You can scrape the beacon for metrics:

```bash
# Get all service response times
curl -s https://beacon.chitty.cc/status | jq -r '.services[] | "chitty_response_time{service=\"\(.service)\"} \(.responseTime)"'

# Get all service uptime
curl -s https://beacon.chitty.cc/status | jq -r '.services[] | "chitty_uptime_24h{service=\"\(.service)\"} \(.uptime24h)"'
```

### Slack Webhook Integration

```bash
#!/bin/bash

STATUS=$(curl -s https://beacon.chitty.cc/status)
OVERALL=$(echo "$STATUS" | jq -r '.overall')
UNHEALTHY=$(echo "$STATUS" | jq -r '.summary.unhealthy')

if [ "$UNHEALTHY" -gt 0 ]; then
  SERVICES=$(echo "$STATUS" | jq -r '.services[] | select(.currentStatus == "unhealthy") | .service' | tr '\n' ', ')

  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"Alert: $UNHEALTHY services are unhealthy: $SERVICES\"}"
fi
```

### Uptime Kuma

Add ChittyBeacon as a monitor in Uptime Kuma:
- Type: HTTP(s)
- URL: https://beacon.chitty.cc/health
- Check interval: 60 seconds
- Expected status code: 200

### Grafana Dashboard

Create a Grafana dashboard using the beacon API as a JSON data source:
1. Add data source: JSON API
2. URL: https://beacon.chitty.cc/status
3. Create panels for:
   - Overall status gauge
   - Response time graph
   - Uptime percentage
   - Service status table
