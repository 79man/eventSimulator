let eventSourceURL = "event-simulator-sse";
let fakeEvents = [];
let send_close_event = false;

const MESSAGE_TYPES = {
  EVENT_SOURCE_URL: "event_source_url",
  FAKE_EVENTS: "fake_events",
  SEND_CLOSE_EVENT: "send_close_event",
};

const channel4Broadcast = new BroadcastChannel("sse-events-channel4");
channel4Broadcast.onmessage = (event) => {
  if (event.data && event.data.message) {
    switch (event.data.message) {
      case MESSAGE_TYPES.EVENT_SOURCE_URL:
        // Store the value in a variable
        console.log(
          "Received URL from Client",
          event.data.event_source_url || null
        );
        if (event.data.event_source_url)
          eventSourceURL = event.data.event_source_url;
        break;
      case MESSAGE_TYPES.FAKE_EVENTS:
        console.log("Received fakeEvents data from Client");
        fakeEvents = event.data.fake_events;
        break;
      case MESSAGE_TYPES.SEND_CLOSE_EVENT:
        send_close_event = event.data.send_close_event;
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
  //console.log("In fetch", event.request.url, eventSourceURL);
  if (event.request.url.endsWith(eventSourceURL)) {
    //console.log("fetch Matched URL", event.request.url);
    const timeoutIds = []; // Track timeout IDs for cleanup
    // Respond with a stream of events
    const stream = new ReadableStream({
      start(controller) {
        ctrlr = controller;
        fakeEvents.forEach((item, index) => {
          const timeoutId = setTimeout(() => {
            console.log("Sending Event(", index, ")");
            ctrlr.enqueue(new TextEncoder().encode("data:" + item + "\n\n"));
          }, index * 2000);
          timeoutIds.push(timeoutId);
        });

        if (send_close_event) {
          const closeTimeoutId = setTimeout(() => {
            console.log("Events Consumed. Sending Close event");
            ctrlr.enqueue(
              new TextEncoder().encode(
                "data:" + JSON.stringify({ id: "CLOSE" }) + "\n\n"
              )
            );
          }, (fakeEvents.length + 1) * 2000);
          timeoutIds.push(closeTimeoutId);
        }

        const finalTimeoutId = setTimeout(() => {
          ctrlr.close();
        }, (fakeEvents.length + 2) * 2000);
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
  }
});
