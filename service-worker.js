// Enhanced service-worker.js with namespaced state
let configurations = new Map(); // Store config per event_source_url

// console.log("Intially configurations:", configurations);
// let eventSourceURL = "event-simulator-sse";
// let fakeEvents = [];
// let send_close_event = false;

const MESSAGE_TYPES = {
  EVENT_SOURCE_URL: "event_source_url",
  FAKE_EVENTS: "fake_events",
  SEND_CLOSE_EVENT: "send_close_event",
};

const channel4Broadcast = new BroadcastChannel("sse-events-channel4");
channel4Broadcast.onmessage = (event) => {
  if (event.data && event.data.message) {
    const eventSourceURL = event.data.event_source_url;

    if (!configurations.has(eventSourceURL)) {
      configurations.set(eventSourceURL, {
        eventSourceURL: eventSourceURL,
        fakeEvents: [],
        send_close_event: false,
      });
      // console.log("Added configuration", configurations);
    }
    const config = configurations.get(eventSourceURL);

    switch (event.data.message) {
      case MESSAGE_TYPES.EVENT_SOURCE_URL:
        // // Store the value in a variable
        // console.log(
        //   "Received URL from Client",
        //   event.data.event_source_url || null
        // );
        // if (event.data.event_source_url)
        //   eventSourceURL = event.data.event_source_url;
        break;
      case MESSAGE_TYPES.FAKE_EVENTS:
        config.fakeEvents = event.data.fake_events;

        console.log(
          "Received ",
          config.fakeEvents.length,
          " fakeEvents data from Client"
        );
        break;
      case MESSAGE_TYPES.SEND_CLOSE_EVENT:
        config.send_close_event = event.data.send_close_event;
        break;
      default:
        console.warn("Unknown message type:", event.data.message);
    }
  }
};

// self.clients.matchAll().then(function (clients) {
//   clients.forEach(function (client) {
//     client.postMessage("The service worker just started up.");
//   });
// });

self.addEventListener("install", (event) => {
  event.waitUntil(
    self.skipWaiting().then(function () {
      console.log("Service worker installed");
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.claim().then(function () {
      // After the activation and claiming is complete, send a message to each of the controlled
      // pages letting it know that it's active.
      // This will trigger navigator.serviceWorker.onmessage in each client.
      return self.clients.matchAll().then(function (clients) {
        return Promise.all(
          clients.map(function (client) {
            //console.log("activating client", client);
            return client.postMessage(
              "The service worker has activated and " + "taken control."
            );
          })
        );
      });
    })
  );
});

self.addEventListener("fetch", (event) => {
  // console.log(`Fetch ${event.request.url}`);

  // Find matching configuration
  const matchingConfig = Array.from(configurations.values()).find((config) =>
    event.request.url.endsWith(config.eventSourceURL)
  );

  if (matchingConfig) {
    // console.log("fetch Matching Config", matchingConfig);
    const timeoutIds = []; // Track timeout IDs for cleanup
    // Respond with a stream of events
    const stream = new ReadableStream({
      start(controller) {        
        matchingConfig.fakeEvents.forEach((item, index) => {
          const timeoutId = setTimeout(() => {
            console.log("Sending Event(", index, ")");
            controller.enqueue(new TextEncoder().encode("data:" + item + "\n\n"));
          }, index * 2000);
          timeoutIds.push(timeoutId);
        });

        if (matchingConfig.send_close_event) {
          const closeTimeoutId = setTimeout(() => {
            console.log("Events Consumed. Sending Close event");
            controller.enqueue(
              new TextEncoder().encode(
                "data:" + JSON.stringify({ id: "CLOSE" }) + "\n\n"
              )
            );
          }, (matchingConfig.fakeEvents.length + 1) * 2000);
          timeoutIds.push(closeTimeoutId);
        }

        const finalTimeoutId = setTimeout(() => {
          controller.close();
        }, (matchingConfig.fakeEvents.length + 2) * 2000);
        timeoutIds.push(finalTimeoutId);
      },

      cancel() {
        // Clean up timeouts if stream is cancelled
        timeoutIds.forEach((id) => clearTimeout(id));
        console.log("Stream cancelled, cleaned up timeouts");
      },
    });

    event.respondWith(
      new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    );
  } else if (event.request.url.endsWith("generate-fake-events-sse-stream")) {
    const stream = new ReadableStream({
      start(controller) {
        let counter = 0;

        // Generate live events every 2 seconds
        const interval = setInterval(() => {
          counter++;
          const eventData = {
            id: counter,
            message: `Live event ${counter}`,
            timestamp: new Date().toISOString(),
            data: `Generated in browser at ${Date.now()}`,
          };

          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(eventData)}\n\n`)
          );

          // Stop after 20 events
          if (counter >= 5) {
            clearInterval(interval);
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ id: "CLOSE" })}\n\n`
              )
            );
            controller.close();
          }
        }, 2000);
      },
    });

    event.respondWith(
      new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    );
  } else {
    console.error(` Fetch for unknown URL ${event.request.url}`);
  }
});
