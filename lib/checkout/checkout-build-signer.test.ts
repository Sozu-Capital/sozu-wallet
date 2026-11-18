import { describe, expect, it } from "vitest";
import { checkoutBuildSigner } from "./checkout-build-signer";

describe("checkoutBuildSigner", () => {
  it("lets a passkey checkout proceed when the builder omits the G signer", () => {
    expect(
      checkoutBuildSigner({ signMethod: "oz_passkey", signerPublicKey: null }),
    ).toEqual({ signerPublicKey: null });
    expect(
      checkoutBuildSigner({ signMethod: "oz_passkey_local", signerPublicKey: null }),
    ).toEqual({ signerPublicKey: null });
  });

  it("still requires a G signer for the factory path", () => {
    const missing = checkoutBuildSigner({ signMethod: "smart_g_signer", signerPublicKey: null });
    expect(missing.error).toMatch(/G…/);
    expect(
      checkoutBuildSigner({
        signMethod: "smart_g_signer",
        signerPublicKey: "G".padEnd(56, "A"),
      }).signerPublicKey,
    ).toBe("G".padEnd(56, "A"));
  });
});
