import { buildAcropolisServiceUrl, getAcropolisBaseHost } from "../AcropolisServiceLinks";

describe("Acropolis service URL helpers", () => {
  it("removes the parthenon subdomain when present", () => {
    expect(getAcropolisBaseHost("parthenon.192.168.1.58.sslip.io")).toBe("192.168.1.58.sslip.io");
  });

  it("keeps the hostname when parthenon is not the current subdomain", () => {
    expect(getAcropolisBaseHost("192.168.1.58.sslip.io")).toBe("192.168.1.58.sslip.io");
  });

  it("builds subdomain launch URLs using the current protocol and port", () => {
    expect(
      buildAcropolisServiceUrl(
        { protocol: "http:", hostname: "parthenon.192.168.1.58.sslip.io", port: "8081" },
        "wazuh",
      ),
    ).toBe("http://wazuh.192.168.1.58.sslip.io:8081/");
  });
});
