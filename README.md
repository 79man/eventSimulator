# EventSimulator

A browser-based Server-Sent Events (SSE) caching and replay system that uses Service Worker technology to capture, store, and simulate SSE streams. Now features **event-driven architecture**, **input validation**, **storage management**, and **enhanced error handling**. Perfect for testing, development, and offline scenarios where you need to replay previously captured event streams.

## Table of Contents

- [EventSimulator](#eventsimulator)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
    - [1. Basic Configuration with Validation 1](#1-basic-configuration-with-validation-1)
    - [2. Complete Workflow Example](#2-complete-workflow-example)
    - [3. Event-Driven Capture with Status Monitoring](#3-event-driven-capture-with-status-monitoring)
    - [4. Enhanced Testing with Status Events](#4-enhanced-testing-with-status-events)
  - [Built-in Event Generator](#built-in-event-generator)
  - [Configuration Options](#configuration-options)
  - [API Reference](#api-reference)
    - [`register()`](#register)
    - [`captureEvents()`](#captureevents)
    - [`stopCapture()`](#stopcapture)
    - [`loadEventsFromStorage()`](#loadeventsfromstorage)
    - [`test(eventSourceURL)`](#testeventsourceurl)
    - [`clearEventsFromStorage()`](#cleareventsfromstorage)
  - [Enhanced Architecture Overview](#enhanced-architecture-overview)
  - [Event Flow](#event-flow)
  - [Error Handling \& Validation](#error-handling--validation)
    - [Configuration Validation](#configuration-validation)
    - [Storage Error Handling](#storage-error-handling)
    - [Enhanced Test Error Handling](#enhanced-test-error-handling)
  - [Storage Management](#storage-management)
    - [Automatic Size Limits](#automatic-size-limits)
    - [Storage Structure](#storage-structure)
  - [Event-Driven Architecture](#event-driven-architecture)
    - [Status Event Structure](#status-event-structure)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues and Solutions](#common-issues-and-solutions)
  - [Performance Considerations](#performance-considerations)
    - [Storage Limits and Memory Management](#storage-limits-and-memory-management)
    - [Concurrent Instance Performance](#concurrent-instance-performance)
  - [Security Notes](#security-notes)
    - [Service Worker Security](#service-worker-security)
    - [CORS Considerations](#cors-considerations)
  - [Browser Compatibility](#browser-compatibility)

## Features

- **Event-Driven Architecture**: Real-time status updates via EventTarget pattern
- **Input Validation**: Type checking and error handling for configuration parameters
- **Storage Management**: Automatic cleanup with configurable size limits (1000 events max)
- **Enhanced Error Handling**: Comprehensive error reporting and recovery
- **Multi-Instance Support**: Run multiple EventSimulator instances simultaneously
- **Built-in Event Generator**: Generate test events without external sources
- **Configurable Service Worker Path**: Custom service worker file locations
- **Stream Control**: Start/stop capture and test operations programmatically
- **Cross-Context Communication**: Uses BroadcastChannel for main thread ↔ Service Worker communication

## Prerequisites

- **Service Worker Support**: Modern browser with Service Worker API support
- **BroadcastChannel Support**: For cross-context communication
- **EventSource Support**: Native SSE support for event capture and testing
- **HTTPS or localhost**: Service Workers require secure contexts

## Installation

Include the EventSimulator source code in your HTML:

```html
<script src="eventSimulator.js"></script>
```

**Required Files:**
- `eventSimulator.js` - Enhanced EventSimulator class with validation and events
- `service-worker.js` - Service Worker with multi-instance support

## Quick Start

### 1. Basic Configuration with Validation [1](#7-0) 

```javascript
const simulator = new EventSimulator({
  event_source_url: "event-simulator-sse",    // SSE endpoint for replay
  capture_url: "https://api.example.com/sse", // External SSE source (Optional)
  localstore_name: "capturedEvents",          // localStorage key (Optional)
  close_event_supported: true,                // Send close events
  service_worker_path: "./custom-sw.js"       // Custom service worker path (Optional)
});
```

### 2. Complete Workflow Example

```javascript
// Complete workflow example using built-in generator
const simulator = new EventSimulator({
  event_source_url: "my-events",
  capture_url: "generate-fake-events-sse-stream", // Use built-in generator
  localstore_name: "myEvents",
  close_event_supported: true
});

// 1. Register service worker
await simulator.register();

// 2. Capture events from built-in generator
const capture = simulator.captureEvents();
capture.on("status", (e) => console.log(`Capture: ${e.detail.status}`));
await capture.promise;

// 3. Load and replay captured events
simulator.loadEventsFromStorage();

// 4. Test the replay
const test = simulator.test("my-events");
test.on("status", (e) => console.log(`Test: ${e.detail.status}`));
await test.promise;
```

### 3. Event-Driven Capture with Status Monitoring

```javascript
// Enhanced captureEvents() returns promise + event emitter
const capture = simulator.captureEvents();

// Monitor capture status in real-time
capture.on("status", (event) => {
  const { status, message, eventCount, lastEvent } = event.detail;
  console.log(`Status: ${status} - ${message} (${eventCount} events)`);
  
  if (status === "capturing" && lastEvent) {
    console.log("Latest event:", lastEvent);
  }
});

// Handle capture completion
capture.promise
  .then(result => {
    console.log(`Capture completed: ${result.totalEvents} events captured`);
  })
  .catch(error => {
    console.error("Capture failed:", error.message);
  });
```

### 4. Enhanced Testing with Status Events

```javascript
// Enhanced test() with event monitoring
const test = simulator.test("event-simulator-sse");

// Monitor test progress
test.on("status", (event) => {
  const { status, message, eventCount } = event.detail;
  console.log(`Test ${status}: ${message}`);
});

// Handle test results
test.promise
  .then(result => {
    console.log(`Test ${result.status}: ${result.totalEvents} events, reason: ${result.reason}`);
  })
  .catch(error => {
    console.error("Test failed:", error.message);
  });
```

## Built-in Event Generator

The service worker includes a built-in event generator accessible at the special endpoint `generate-fake-events-sse-stream`. This is useful for testing and development when you don't have access to external SSE sources.

```javascript
// Connect directly to the built-in generator
const testEvents = new EventSource("generate-fake-events-sse-stream");

testEvents.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Generated event:", data);
  
  // The generator automatically sends a CLOSE event after 5 events
  if (data.id === "CLOSE") {
    testEvents.close();
    console.log("Generator completed");
  }
};

testEvents.onerror = (error) => {
  console.error("Generator connection failed:", error);
};
```

**Generated Event Structure:**
The built-in generator produces events with this structure:
```json
{
  "id": 1,
  "message": "Live event 1",
  "timestamp": "2023-04-04T10:30:00.000Z",
  "data": "Generated in browser at 1680602200000"
}
```

**Generator Behavior:**
- Generates 5 events total with 2-second intervals
- Each event has an incrementing `id` field
- Includes current timestamp and browser-generated data
- Automatically sends `{id: "CLOSE"}` after the final event
- Stream closes automatically after completion

**Use Cases:**
- Testing EventSimulator functionality without external dependencies
- Development and debugging of SSE handling code
- Demonstrating the system capabilities in offline environments
- Quick validation of the service worker setup

This generator runs independently of any EventSimulator instance configuration and doesn't require registration or setup - it's always available once the service worker is active.

## Configuration Options

| Parameter | Type | Default | Required | Description |
|-----------|------|---------|----------|-------------|
| `event_source_url` | string | `"/event-simulator-sse"` | No | SSE endpoint URL for event replay (validated) |
| `capture_url` | string | `generate-fake-events-sse-stream` | No* | External SSE source for event capture (validated) |
| `localstore_name` | string | `"fakeEvents"` | No | localStorage key for event storage |
| `close_event_supported` | boolean | `false` | No | Send `{id: 'CLOSE'}` after all events |
| `service_worker_path` | string | `"./service-worker.js"` | No | Custom service worker file path |

*Required when using `captureEvents()`

**Input Validation**: Configuration parameters are validated at construction time, throwing descriptive errors for invalid types.

## API Reference

### `register()`
Registers the Service Worker and configures the SSE simulation endpoint. Multiple instances share the same service worker but maintain separate configurations. 

```javascript
simulator.register()  
  .then(() => console.log("Registration completed"))  
  .catch(error => console.error("Registration failed:", error));
```

### `captureEvents()`

Returns an object with `promise` and `on()` method for event monitoring:

```javascript
const capture = simulator.captureEvents();

// Event types: "status"
// Status values: "connecting", "connected", "capturing", "completed", "error", "stopped"
capture.on("status", (event) => {
  console.log(event.detail.status, event.detail.message);
});

capture.promise.then(result => {
  console.log("Capture result:", result);
});
```

### `stopCapture()`

Manually stop an active capture operation:

```javascript
const success = simulator.stopCapture();
console.log("Capture stopped:", success);
```

### `loadEventsFromStorage()`

Loads cached events from localStorage and sends them to the Service Worker for replay.

```javascript
// Events will be served with 2-second delays between messages
simulator.loadEventsFromStorage();
```

### `test(eventSourceURL)`

Enhanced testing with comprehensive error handling and status events:

```javascript
const test = simulator.test("event-simulator-sse");

test.on("status", (event) => {
  // Status values: "connecting", "connected", "receiving", "completed", "error", "closed"
  console.log(`${event.detail.status}: ${event.detail.message}`);
});

test.promise.then(result => {
  // result.status: "completed", "closed"
  // result.reason: "close_event_received", "stream_ended", "connection_closed"
  console.log("Test result:", result);
});
```

### `clearEventsFromStorage()`

Clear all stored events from localStorage:

```javascript
simulator.clearEventsFromStorage();
```

## Enhanced Architecture Overview

`EventSimulator` uses a **namespaced Service Worker architecture** supporting multiple concurrent instances:

```
┌─────────────────┐    BroadcastChannel    ┌──────────────────────┐
│   Main Thread   │◄──────────────────────►│   Service Worker     │
│                 │                        │                      │
│ EventSimulator  │                        │ configurations Map   │
│ Instance 1      │                        │ ┌─────────────────┐  │
│ Instance 2      │                        │ │ URL1 → Config1  │  │
│ Instance N      │                        │ │ URL2 → Config2  │  │
└─────────────────┘                        │ │ URL3 → Config3  │  │
         │                                 │ └─────────────────┘  │
         ▼                                 └──────────────────────┘
┌─────────────────┐                                   │
│  localStorage   │                                   ▼
│                 │                        ┌──────────────────────┐
│ Multiple Keys   │                        │ Request Matching &   │
│ events1, events2│                        │ Stream Generation    │
└─────────────────┘                        └──────────────────────┘
```

**Key Features:**
- **Namespaced Configurations**: Each `event_source_url` gets its own configuration object
- **Multi-Instance Support**: Multiple EventSimulator instances can run simultaneously
- **Stream Cleanup**: Automatic timeout cleanup when streams are cancelled
- **Built-in Generator**: `generate-fake-events-sse-stream` endpoint for testing
- **Message Type Constants**: Structured message handling with defined types

## Event Flow

1. **Registration Phase**: Each instance registers with a unique `event_source_url`
2. **Configuration Storage**: Service Worker maintains separate configs per URL in a Map
3. **Capture Phase**: `captureEvents()` connects to external SSE and stores events
4. **Replay Phase**: `loadEventsFromStorage()` sends cached events to the appropriate config
5. **Simulation Phase**: Service Worker matches requests and serves events with cleanup
6. **Testing Phase**: `test()` validates the simulated SSE endpoint

## Error Handling & Validation

### Configuration Validation

The constructor validates input parameters and throws descriptive errors:

```javascript
// These will throw validation errors:
new EventSimulator({ capture_url: 123 });        // "capture_url must be a string"
new EventSimulator({ event_source_url: [] });    // "event_source_url must be a string"
```

### Storage Error Handling

Storage operations include comprehensive error handling with automatic cleanup and size limits.

### Enhanced Test Error Handling

The test method now distinguishes between actual errors and expected stream termination behavior.

## Storage Management

### Automatic Size Limits

- **Maximum Events**: 1000 events per storage key
- **Cleanup Strategy**: FIFO (oldest events removed first)
- **Warning System**: Console warnings when limits are reached

### Storage Structure

Events are stored as JSON arrays in localStorage with automatic serialization and size management.

## Event-Driven Architecture

Both `captureEvents()` and `test()` methods now return objects with:
- **`promise`**: For handling completion/failure
- **`on(event, callback)`**: For real-time status monitoring

### Status Event Structure

```javascript
{
  detail: {
    status: "connecting" | "connected" | "capturing" | "receiving" | "completed" | "error" | "stopped" | "closed",
    message: "Human-readable status message",
    eventCount: 42,
    lastEvent: { /* parsed event data */ }  // when available
  }
}
```

## Troubleshooting

### Common Issues and Solutions

**Service Worker Registration Failed** 
- Ensure HTTPS or localhost environment
- Check browser Service Worker support
- Verify `service-worker.js` file exists and is accessible

**Configuration Conflicts**
- Ensure each EventSimulator instance uses a unique `event_source_url`
- Check browser console for "Unknown message type" warnings
- Verify localStorage keys don't conflict between instances

**Stream Cleanup Issues**
- The enhanced service worker automatically cleans up timeouts when streams are cancelled
- Monitor console for "Stream cancelled, cleaned up timeouts" messages

**CORS Issues with External SSE**
- Configure proper CORS headers on the external SSE server
- Use same-origin URLs when possible
- Consider proxy solutions for cross-origin scenarios

**Event Capture Not Working**
- Verify `capture_url` is accessible and returns valid SSE format
- Check browser console for EventSource connection errors
- Ensure external server supports EventSource connections

## Performance Considerations

### Storage Limits and Memory Management

- **Event Limit**: The system automatically limits storage to 1000 events per instance
- **Memory Impact**: Large event payloads can impact browser performance
- **Cleanup Strategy**: Oldest events are automatically removed when limits are reached
- **Monitoring**: Watch for console warnings about storage limits

### Concurrent Instance Performance

- Multiple EventSimulator instances share the same Service Worker
- Each instance maintains separate configuration and storage
- Consider the cumulative memory impact of multiple active streams

## Security Notes

### Service Worker Security

- Service Workers require secure contexts (HTTPS or localhost)
- Service Workers can intercept all network requests within their scope
- Ensure proper validation of event data to prevent XSS attacks

### CORS Considerations

- External SSE sources must have proper CORS headers configured
- Cross-origin requests may be blocked by browser security policies
- Consider using same-origin proxy endpoints for external sources

## Browser Compatibility

- **Chrome/Edge**: Full support (Service Workers + BroadcastChannel + EventTarget)
- **Firefox**: Full support
- **Safari**: Requires iOS 11.3+ / macOS 10.13.4+ for Service Worker support
- **IE**: Not supported (no Service Worker support)

