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
    this.serviceWorker_file = config.service_worker_path || "./service-worker.js";
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
      throw new Error("capture_url is required for captureEvents()");
    }
    console.log("Capturing events from", this.configuration.captureURL);

    const eventSource = new EventSource(this.configuration.captureURL);
    self = this;

    eventSource.onmessage = function (event) {
      try {
        self.saveEventToLocalstorage(event);
      } catch (error) {
        console.error("Failed to save event to localStorage:", error);
      }
    };

    eventSource.onerror = function (error) {
      console.error("EventSource connection error:", error);
      eventSource.close();
    };

    return eventSource; // Return for external control
  }

  test(eventSourceURL) {
    return new Promise(function (resolve, reject) {
      // Create an EventSource object and subscribe to the server-sent events
      console.log("Test:: Trying to Open EventSource", eventSourceURL);
      const eventSource = new EventSource(eventSourceURL);
      let event_counter = 0;

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

        if ((event_data.id || "NONE") == "CLOSE") {
          console.log("Test:: Received CLOSE message from Server");
          eventSource.close();
        }
      });

      eventSource.addEventListener("error", (event) => {
        const errorDetails = {
          readyState: eventSource.readyState,
          url: eventSourceURL,
          timestamp: new Date().toISOString(),
        };
        console.error("EventSource Error:", errorDetails, event);
        event_counter = 0;
        eventSource.close();
        reject(
          new Error(`EventSource failed: ${JSON.stringify(errorDetails)}`)
        );
      });

      eventSource.addEventListener("close", (event) => {
        console.log("Closed", event);
        event_counter = 0;
        resolve();
        // Handle the error here
      });
    });
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
    this.channel4Broadcast.postMessage({
      message: "fake_events",
      fake_events:
        JSON.parse(localStorage.getItem(this.configuration.localStorageName)) ||
        [],
    });
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
              });
            }

            resolve();
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
