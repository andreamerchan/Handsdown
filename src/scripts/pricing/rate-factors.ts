// "Run the search" button in the "Set by the specialist your team needs" section.

import { openBooking } from "./open-booking";

document
  .querySelector<HTMLButtonElement>(
    'section[aria-labelledby="what-shapes-your-rate"] button[type="button"]',
  )
  ?.addEventListener("click", openBooking);
