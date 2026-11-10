// The pricing page has two buttons that start a search without any text
// ("Describe your role" in the estimator, "Run the search" under the rate factors).
// They lead to the booking page, like an empty "describe your role" form does.

const BOOKING_URL = "/book";

export function openBooking(): void {
  window.location.assign(BOOKING_URL);
}
