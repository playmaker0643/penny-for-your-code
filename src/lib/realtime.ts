export const waitForChannelSubscription = (channel: any) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Realtime connection timed out"));
    }, 10000);

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timeout);
        resolve();
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        window.clearTimeout(timeout);
        reject(new Error(`Realtime connection failed: ${status}`));
      }
    });
  });