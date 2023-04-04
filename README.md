# eventSimulator
Browser based SSE Event caching and replay support

# Include the js eventSimulator source code
<script src="eventSimulator.js"></script>

# Create a new EventSimulator object with configuration
```
SIM = new EventSimulator({
  /*
   * The eventSource URL to publish event to
   */
  event_source_url: "event-simulator-sse",

  /*
   * The SSE URL to capture events from
   */
  capture_url: "UrlToSSE_Stream",

  /* 
   * The localstore to use as the destination for saving captured events,
   * and the source for the events to publish to event_source_url
   */
  localstore_name: "capturedEvents",

  /* If True, send a special message {id : 'CLOSE'} after all stored events
   * have been sent out and before the Stream is closed.
   *
   * If False, close the stream after all stored events have been consumed.
   */
  close_event_supported: true,
});
```

# `register()` for starting the service worker
```
/*
  * Calling `register` will register a service-worker and publish 
  * an `EventSource()`` compatible URL.
  *
  * The URL can be specified using the parameter `event_source_url`.
  * 
  */
SIM.register()
.then(function () {
  console.log("Registration Completed...");
})
.catch((error) => {
  console.error("Registration failed", error);
});

/*
 * Calling `captureEvents` will open an EventSource(`capture_url`)
 * event.data from all incoming events will be saved to 
 * localStorage(`localstore_name`)
 */
SIM.captureEvents();

/*
* Calling `loadEventsFromStorage` will load the cached events from
* localStorage(`localstore_name`) and publish them to the service-worker.
* 
* The Service worker will then start publishing each event to `event_source_url`.
* The event messages will be dispatched with a delay of 2 seconds between messages.
* 
*/
SIM.loadEventsFromStorage();

/*
* Calling `test(EventSource URL)` will connect to the specified event source URL.
* It will print the contents of each message that it receives.
*
* In case it receives a special message {id : 'CLOSE'}, it'll close the source stream.
* 
*/
SIM.test("event-simulator-sse")
.then(function () {
  console.log("Test Returned success");
})
.catch((error) => {
  console.error("Test Returned failure:", error);
});
```
