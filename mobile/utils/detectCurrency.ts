import { CURRENCIES } from "../constants/currencies";

// Best guess at a new user's currency, with no location permission needed.
//
// The time zone comes first: it follows where the phone actually is
// ("Europe/Sofia" → euro). The language/region setting is only a fallback —
// plenty of people run their phone in English (US) wherever they live, which
// would wrongly suggest dollars. Returns null when unsure, or when the
// currency isn't one the app offers; the app then asks instead.

const EURO_ZONES = [
  "Europe/Sofia", "Europe/Berlin", "Europe/Paris", "Europe/Madrid", "Europe/Rome",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Vienna", "Europe/Lisbon",
  "Europe/Dublin", "Europe/Helsinki", "Europe/Athens", "Europe/Tallinn",
  "Europe/Riga", "Europe/Vilnius", "Europe/Bratislava", "Europe/Ljubljana",
  "Europe/Zagreb", "Europe/Luxembourg", "Europe/Malta", "Europe/Monaco",
  "Europe/Andorra", "Europe/San_Marino", "Europe/Vatican", "Europe/Podgorica",
  "Europe/Mariehamn", "Europe/Nicosia", "Asia/Nicosia", "Asia/Famagusta",
  "Atlantic/Madeira", "Atlantic/Azores", "Atlantic/Canary", "Africa/Ceuta",
];

const ZONE_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EURO_ZONES.map((zone) => [zone, "EUR"])),
  "Europe/London": "GBP", "Europe/Guernsey": "GBP", "Europe/Jersey": "GBP", "Europe/Isle_of_Man": "GBP",
  "Europe/Zurich": "CHF", "Europe/Vaduz": "CHF",
  "Europe/Warsaw": "PLN", "Europe/Bucharest": "RON", "Europe/Prague": "CZK",
  "Europe/Budapest": "HUF", "Europe/Stockholm": "SEK", "Europe/Copenhagen": "DKK",
  "Europe/Oslo": "NOK", "Europe/Istanbul": "TRY", "Europe/Belgrade": "RSD",
  "Europe/Kyiv": "UAH", "Europe/Kiev": "UAH",
  "Asia/Tokyo": "JPY", "Asia/Shanghai": "CNY", "Asia/Chongqing": "CNY", "Asia/Urumqi": "CNY",
  "Asia/Seoul": "KRW",
  "Pacific/Auckland": "NZD",
};

// Fallback: the region part of the phone's language setting (e.g. "de-AT").
const REGION_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(
    ["BG", "DE", "FR", "ES", "IT", "NL", "BE", "AT", "PT", "IE", "FI", "GR", "EE", "LV",
      "LT", "SK", "SI", "HR", "LU", "MT", "CY", "MC", "AD", "SM", "VA", "ME"].map((r) => [r, "EUR"]),
  ),
  GB: "GBP", CH: "CHF", LI: "CHF", PL: "PLN", RO: "RON", CZ: "CZK", HU: "HUF",
  SE: "SEK", DK: "DKK", NO: "NOK", TR: "TRY", RS: "RSD", UA: "UAH",
  US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD", JP: "JPY", CN: "CNY", KR: "KRW",
};

function currencyForZone(timeZone: string): string | null {
  if (ZONE_CURRENCY[timeZone]) return ZONE_CURRENCY[timeZone];
  if (timeZone.startsWith("Australia/")) return "AUD";
  if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal|Moncton|Whitehorse|Yellowknife|Iqaluit)$/.test(timeZone)) {
    return "CAD";
  }
  if (/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+)|Pacific\/Honolulu)$/.test(timeZone)) {
    return "USD";
  }
  return null;
}

export function detectCurrency(
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  locale: string = Intl.DateTimeFormat().resolvedOptions().locale ?? "",
): string | null {
  const region = locale.match(/[-_]([A-Z]{2})(?:\b|[-_])/)?.[1];
  const guess = currencyForZone(timeZone) ?? (region ? REGION_CURRENCY[region] : undefined);
  return guess && CURRENCIES.some((c) => c.code === guess) ? guess : null;
}
