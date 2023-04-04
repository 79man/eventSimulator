class EventSimulator {
  constructor(config) {
    this.configuration = {};
    this.configuration.localStorageName =
      config.localstore_name || "fakeEvents";
    this.configuration.captureURL = config.capture_url || null;

    this.eventSourceURL = config.event_source_url || "/event-simulator-sse";
    this.serviceWorker_file = "/eventSimulator/service-worker.js";
    this.channel4Broadcast = new BroadcastChannel("sse-events-channel4");
    this.close_event_supported = config.close_event_supported || false;
  }

  saveEventToLocalstorage(event) {
    const events =
      JSON.parse(localStorage.getItem(this.configuration.localStorageName)) ||
      [];

    events.push(event.data);
    localStorage.setItem(
      this.configuration.localStorageName,
      JSON.stringify(events)
    );
  }

  // This can be invoked even without registering service worker
  captureEvents() {
    console.log(
      "Capturing events from",
      this.configuration.captureURL,
      "to localStorage(",
      this.configuration.localStorageName,
      ")"
    );
    const eventSource = new EventSource(this.configuration.captureURL);
    self = this;
    eventSource.onmessage = function (event) {
      // Save the events to localStorage
      self.saveEventToLocalstorage(event);
    };
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
        console.error("Error", event);
        event_counter = 0;
        // Handle the error here
        reject();
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
          .register("./service-worker.js", { scope: "./" })
          .then(self.waitUntilInstalled)
          .then(function (payload) {
            return navigator.serviceWorker.ready;
          })
          .then(function (ready) {
            console.log("serviceWorker is ready");
            self.sendChannelURLtoServiceWorker(self);
            if (self.close_event_supported) {
              self.sendMessagetoServiceWorker(self, {
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
