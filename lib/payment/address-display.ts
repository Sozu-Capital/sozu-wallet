/** Splits an address into 4-char groups so it can be read aloud and compared on a confirm screen. Never truncates. */
export function groupAddressForDisplay(address: string): string {
  return address.replace(/(.{4})(?=.)/g, "$1 ")
}
