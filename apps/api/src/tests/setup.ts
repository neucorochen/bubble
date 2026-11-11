import { beforeEach } from "vitest";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://localhost:27017/commune-test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-123";

process.env.RESEND_API_KEY = "";
process.env.GOOGLE_CLIENT_ID = "";
process.env.LEMONSQUEEZY_API_KEY = "";
process.env.LEMONSQUEEZY_STORE_ID = "";
process.env.LEMONSQUEEZY_VARIANT_ID = "";
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "";
process.env.PLATFORM_FEE_PERCENT = "20";
process.env.PLUS_FEE_PERCENT = "10";
process.env.LEMONSQUEEZY_PLUS_VARIANT_ID = "";
process.env.REQUIRE_VERIFIED_EMAIL = "false";
process.env.REALTIME_URL = "";
process.env.REALTIME_SECRET = "";
process.env.VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
process.env.VAPID_SUBJECT = "";

// Write routes run requireActive, which looks the user up in MongoDB.
// These tests have no database, so by default every test gets an active regular user.
beforeEach(async () => {
  const { mockUser } = await import("./helpers.js");
  mockUser({ role: "user", banned: false });
});
