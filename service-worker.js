let eventSourceURL = "event-simulator-sse";
let fakeEvents = [];
let send_close_event = false;

const channel4Broadcast = new BroadcastChannel("sse-events-channel4");
channel4Broadcast.onmessage = (event) => {
  if (event.data && event.data.message) {
    if (event.data.message == "event_source_url") {
      // Store the value in a variable
      console.log(
        "Received URL from Client",
        event.data.event_source_url || null
      );
      if (event.data.event_source_url)
        eventSourceUrl = event.data.event_source_url;
    } else if (event.data.message == "fake_events") {
      console.log("Received fakeEvents data from Client");
      fakeEvents = event.data.fake_events;
    } else if (event.data.message == "send_close_event") {
      send_close_event = event.data.send_close_event;
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
    // Respond with a stream of events
    const stream = new ReadableStream({
      start(controller) {
        fakeEvents.map((item, index) => {
          setTimeout(() => {
            console.log("Sending Event(", index, ")");
            controller.enqueue(
              new TextEncoder().encode("data:" + item + "\n\n")
            );
          }, index * 2000);
        });

        if (send_close_event) {
          setTimeout(() => {
            console.log("Events Consumed. Sending Close event");
            controller.enqueue(
              new TextEncoder().encode(
                "data:" + JSON.stringify({ id: "CLOSE" }) + "\n\n"
              )
            );
          }, (fakeEvents.length + 1) * 2000);
        }

        setTimeout(() => {
          controller.close();
        }, (fakeEvents.length + 2) * 2000);
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
