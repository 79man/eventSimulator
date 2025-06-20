class EventSimulator {
  constructor(config = {}) {
    // Validate configuration
    if (config.capture_url && typeof config.capture_url !== "string") {
      throw new Error("capture_url must be a string");
    }
    if (
      config.event_source_url &&
      typeof config.event_source_url !== "string"
    ) {
      throw new Error("event_source_url must be a string");
    }

    this.configuration = {};
    this.configuration.localStorageName =
      config.localstore_name || "fakeEvents";
    this.configuration.captureURL = config.capture_url || null;

    this.eventSourceURL = config.event_source_url || "/event-simulator-sse";
    this.serviceWorker_file =
      config.service_worker_path || "./service-worker.js";
    this.channel4Broadcast = new BroadcastChannel("sse-events-channel4");
    this.close_event_supported = config.close_event_supported || false;
  }

  saveEventToLocalstorage(event) {
    try {
      const storageKey = this.configuration.localStorageName;
      const events = JSON.parse(localStorage.getItem(storageKey)) || [];

      // Add size limit to prevent memory issues
      const MAX_EVENTS = 1000;
      if (events.length >= MAX_EVENTS) {
        events.shift(); // Remove oldest event
        console.warn(
          `Event storage limit reached (${MAX_EVENTS}), removing oldest event`
        );
      }

      events.push(event.data);
      console.log("setItem(", storageKey, JSON.stringify(events), ")");

      localStorage.setItem(storageKey, JSON.stringify(events));
    } catch (error) {
      console.error("Failed to save event to localStorage:", error);
      throw error;
    }
  }

  // This can be invoked even without registering service worker
  captureEvents() {
    if (!this.configuration.captureURL) {
      return Promise.reject(
        new Error("capture_url is required for captureEvents()")
      );
    }

    this.currentEventSource = null;
    this.captureEventEmitter = null;
    this.captureStatusCallback = null;
    this.captureEventCount = 0;

    const eventEmitter = new EventTarget();
    let eventCount = 0;

    const capturePromise = new Promise((resolve, reject) => {
      const eventSource = new EventSource(this.configuration.captureURL);
      const self = this;

      // Store references for stopCapture()
      this.currentEventSource = eventSource;
      this.captureEventEmitter = eventEmitter;
      this.captureEventCount = eventCount;

      // Emit connecting status
      eventEmitter.dispatchEvent(
        new CustomEvent("status", {
          detail: {
            status: "connecting",
            message: "Connecting to SSE stream...",
            eventCount: 0,
          },
        })
      );

      eventSource.onopen = function () {
        eventEmitter.dispatchEvent(
          new CustomEvent("status", {
            detail: {
              status: "connected",
              message: "Connected to SSE stream",
              eventCount: 0,
            },
          })
        );
      };

      eventSource.onmessage = function (event) {
        try {
          self.saveEventToLocalstorage(event);
          eventCount++;

          const data = JSON.parse(event.data);

          // Emit capturing status
          eventEmitter.dispatchEvent(
            new CustomEvent("status", {
              detail: {
                status: "capturing",
                message: `Captured ${eventCount} events`,
                eventCount: eventCount,
                lastEvent: data,
              },
            })
          );

          if (data.id === "CLOSE") {
            eventSource.close();
            eventEmitter.dispatchEvent(
              new CustomEvent("status", {
                detail: {
                  status: "completed",
                  message: `Capture completed. Total events: ${eventCount}`,
                  eventCount: eventCount,
                },
              })
            );
            resolve({ status: "completed", totalEvents: eventCount });
          }
        } catch (error) {
          eventEmitter.dispatchEvent(
            new CustomEvent("status", {
              detail: {
                status: "error",
                message: `Error: ${error.message}`,
                eventCount: eventCount,
              },
            })
          );
        }
      };

      eventSource.onerror = function (error) {
        eventSource.close();
        eventEmitter.dispatchEvent(
          new CustomEvent("status", {
            detail: {
              status: "error",
              message: "EventSource connection failed",
              eventCount: eventCount,
            },
          })
        );
        reject(new Error("EventSource connection failed"));
      };
    });

    return {
      promise: capturePromise,
      on: (event, callback) => eventEmitter.addEventListener(event, callback),
    };
  }

  stopCapture() {
    if (this.currentEventSource) {
      // Close the EventSource connection
      this.currentEventSource.close();

      // If using EventEmitter pattern, emit stop event
      if (this.captureEventEmitter) {
        this.captureEventEmitter.dispatchEvent(
          new CustomEvent("status", {
            detail: {
              status: "stopped",
              message: "Capture manually stopped",
              eventCount: this.captureEventCount || 0,
            },
          })
        );
      }

      // Clean up references
      this.currentEventSource = null;
      this.captureEventEmitter = null;
      this.captureStatusCallback = null;
      this.captureEventCount = 0;

      return true;
    }
    return false;
  }

  test(eventSourceURL) {
    if (!eventSourceURL) {
      return Promise.reject(new Error("eventSourceURL is required for test()"));
    }

    const eventEmitter = new EventTarget();
    let event_counter = 0;

    const testPromise = new Promise((resolve, reject) => {
      console.log("Test:: Trying to Open EventSource", eventSourceURL);
      const eventSource = new EventSource(eventSourceURL);

      // Emit connecting status
      eventEmitter.dispatchEvent(
        new CustomEvent("status", {
          detail: {
            status: "connecting",
            message: `Connecting to test EventSource: ${eventSourceURL}`,
            eventCount: 0,
          },
        })
      );

      eventSource.addEventListener("open", () => {
        eventEmitter.dispatchEvent(
          new CustomEvent("status", {
            detail: {
              status: "connected",
              message: "Connected to test EventSource",
              eventCount: 0,
            },
          })
        );
      });

      eventSource.addEventListener("message", (event) => {
        event_counter++;
        let event_data = JSON.parse(event.data);

        console.log(
          "Test:: Received messaged from SSE",
          event_counter,
          ", id:(",
          event_data.id || "NONE",
          ")",
          event_data
        );

        // Emit message received status
        eventEmitter.dispatchEvent(
          new CustomEvent("status", {
            detail: {
              status: "receiving",
              message: `Received ${event_counter} events`,
              eventCount: event_counter,
              lastEvent: event_data,
            },
          })
        );

        if ((event_data.id || "NONE") == "CLOSE") {
          console.log("Test:: Received CLOSE message from Server");
          eventSource.close();

          eventEmitter.dispatchEvent(
            new CustomEvent("status", {
              detail: {
                status: "completed",
                message: `Test completed. Total events received: ${event_counter}`,
                eventCount: event_counter,
              },
            })
          );

          resolve({
            status: "completed",
            totalEvents: event_counter,
            reason: "close_event_received",
          });
        }
      });

      eventSource.addEventListener("error", (event) => {
        // Check if this is expected behavior for send_close_event: false
        if (event_counter > 0 && !this.close_event_supported) {
          // This might be normal stream termination, not an error
          console.log(
            "Stream ended after receiving events (expected for send_close_event: false)"
          );
          
          eventSource.close();
          event_counter = 0;

          resolve({
            status: "completed",
            totalEvents: event_counter,
            reason: "stream_ended",
          });
        } else {
          // Actual error
          const errorDetails = {
            readyState: eventSource.readyState,
            url: eventSourceURL,
            timestamp: new Date().toISOString(),
          };
          console.error("EventSource Error:", errorDetails, event);
          event_counter = 0;
          eventSource.close();

          eventEmitter.dispatchEvent(
            new CustomEvent("status", {
              detail: {
                status: "error",
                message: `EventSource connection failed: ${JSON.stringify(
                  errorDetails
                )}`,
                eventCount: event_counter,
              },
            })
          );

          reject(
            new Error(`EventSource failed: ${JSON.stringify(errorDetails)}`)
          );
        }
      });

      eventSource.addEventListener("close", (event) => {
        console.log("Closed", event);
        event_counter = 0;

        eventEmitter.dispatchEvent(
          new CustomEvent("status", {
            detail: {
              status: "closed",
              message: "EventSource connection closed",
              eventCount: event_counter,
            },
          })
        );

        resolve({
          status: "closed",
          totalEvents: event_counter,
          reason: "connection_closed",
        });
      });

      // Store reference for potential stopTest() method
      this.currentTestEventSource = eventSource;
      this.testEventEmitter = eventEmitter;
      this.testEventCount = event_counter;
    });

    return {
      promise: testPromise,
      on: (event, callback) => eventEmitter.addEventListener(event, callback),
    };
  }

  waitUntilInstalled(registration) {
    return new Promise(function (resolve, reject) {
      if (registration.installing) {
        // If the current registration represents the "installing" service worker, then wait
        registration.installing.addEventListener("statechange", function (e) {
          if (e.target.state == "installed") {
            resolve();
          } else if (e.target.state == "redundant") {
            reject();
          }
        });
      } else {
        // Otherwise, if this isn't the "installing" service worker, then installation must have been
        // completed during a previous visit to this page.
        resolve();
      }
    });
  }

  sendChannelURLtoServiceWorker(self) {
    console.log({
      event_source_url: self.eventSourceURL,
    });

    this.channel4Broadcast.postMessage({
      message: "event_source_url",
      event_source_url: self.eventSourceURL,
    });
  }

  sendMessagetoServiceWorker(message_payload) {
    this.channel4Broadcast.postMessage(message_payload);
  }

  loadEventsFromStorage() {
    let stored_events =
      JSON.parse(localStorage.getItem(this.configuration.localStorageName)) ||
      [];

    console.log("Obtained ", stored_events.length, " events from localStorage");

    this.channel4Broadcast.postMessage({
      message: "fake_events",
      fake_events: stored_events,
      event_source_url: this.eventSourceURL, // Add this line
    });
  }

  clearEventsFromStorage() {
    localStorage.setItem(
      this.configuration.localStorageName,
      JSON.stringify([])
    );
    console.log("Cleared Events from LocalStorage");
  }

  register() {
    // Register the service worker
    self = this;
    return new Promise(function (resolve, reject) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register(self.serviceWorker_file, { scope: "./" })
          .then(self.waitUntilInstalled)
          .then(function (payload) {
            return navigator.serviceWorker.ready;
          })
          .then(function (ready) {
            console.log("serviceWorker is ready");
            self.sendChannelURLtoServiceWorker(self);
            if (self.close_event_supported) {
              self.sendMessagetoServiceWorker({
                message: "send_close_event",
                send_close_event: true,
                event_source_url: self.eventSourceURL, // Add this line
              });
            }

            resolve("OK");
          })
          .catch((error) => {
            //console.error("Service worker registration failed:", error);
            reject(error);
          });
      } else {
        reject("serviceWorker is not supported in this browser");
      }
    });
  }
}
