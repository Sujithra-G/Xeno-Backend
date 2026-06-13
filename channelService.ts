import { ChannelReceivePayload, ChannelCallbackPayload, CampaignChannel } from "../types.ts";

/**
 * Decoupled Simulated Channel Service
 * Models the full lifecycle of messaging providers (WhatsApp, SMS, Email, RCS).
 * It simulates network transit, reading, clicking, and attribution purchase.
 * It broadcasts status callbacks back to the CRM Receipt API.
 */
export const channelServiceProvider = {
  async processSimulatedMessage(payload: ChannelReceivePayload): Promise<void> {
    const { communicationId, callbackUrl, channel, recipient } = payload;

    console.log(`[ChannelService] Received message for delivery via [${channel}] to ${recipient}. ID: ${communicationId}`);

    // Define random failures to test delivery system resilience
    const rand = Math.random();
    const isFailed = rand < 0.08; // 8% failure rate

    // 1. Simulate "delivered" (or "failed") after 1.5 seconds
    setTimeout(async () => {
      try {
        const finalStatus = isFailed ? "failed" : "delivered";
        await this.postCallback(callbackUrl, {
          communicationId,
          status: finalStatus,
          timestamp: new Date().toISOString()
        });

        if (isFailed) return; // Stop if failed

        // 2. Simulate "opened" after 3.5 seconds (75% open rate for non-SMS, 50% for SMS/WhatsApp)
        const openProb = channel === "Email" || channel === "RCS" ? 0.8 : 0.6;
        const isOpened = Math.random() < openProb;

        if (isOpened) {
          setTimeout(async () => {
            await this.postCallback(callbackUrl, {
              communicationId,
              status: "opened",
              timestamp: new Date().toISOString()
            });

            // 3. Simulate "read" after 5 seconds (80% read rate of those opened)
            const isRead = Math.random() < 0.85;
            if (isRead) {
              setTimeout(async () => {
                await this.postCallback(callbackUrl, {
                  communicationId,
                  status: "read",
                  timestamp: new Date().toISOString()
                });

                // 4. Simulate "clicked" after 6.5 seconds (40% click rate of those read)
                const isClicked = Math.random() < 0.45;
                if (isClicked) {
                  setTimeout(async () => {
                    await this.postCallback(callbackUrl, {
                      communicationId,
                      status: "clicked",
                      timestamp: new Date().toISOString()
                    });

                    // 5. Simulate "purchase conversion" after 8 seconds (35% buy chance of clicked links!)
                    const isPurchased = Math.random() < 0.35;
                    if (isPurchased) {
                      setTimeout(async () => {
                        await this.postCallback(callbackUrl, {
                          communicationId,
                          status: "clicked", // Still clicked, but flag a conversion order simulation
                          timestamp: new Date().toISOString(),
                          simulatePurchase: true
                        });
                      }, 1500);
                    }

                  }, 1500);
                }

              }, 1500);
            }

          }, 2000);
        }

      } catch (err) {
        console.error(`[ChannelService] Error processing delivery for ID: ${communicationId}`, err);
      }
    }, 1500);
  },

  // Fire webhook back into CRM
  async postCallback(callbackUrl: string, body: ChannelCallbackPayload): Promise<void> {
    try {
      console.log(`[ChannelService API Callback] Sending event [${body.status}] for ${body.communicationId} (simulatePurchase: ${!!body.simulatePurchase})`);
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Channel-Service-Token": "xeno_provider_token_secure_xyz" // simulated API authorization token!
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        console.error(`[ChannelService API Callback] CRM callback returned status error: ${response.status}`);
      }
    } catch (err) {
      console.error(`[ChannelService API Callback] Failed to execute callback post to CRM:`, err);
    }
  }
};
