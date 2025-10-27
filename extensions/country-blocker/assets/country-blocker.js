if (!customElements.get("country-blocker")) {
  customElements.define(
    "country-blocker",
    class CountryBlocker extends HTMLElement {
      constructor() {
        super();
        this.config = {
          mode: this.dataset.blockingmode,
          countries: this.dataset.countrylist?.split(",").map(c => c.trim()) || [],
          ips: this.dataset.blockedipaddresses?.split(",").map(ip => ip.trim()) || [],
          blockBy: this.dataset.blockby, // Add blockBy configuration
          logoUrl:
            this.dataset.logourl ||
            "https://cdn-icons-png.flaticon.com/512/565/565547.png",
        };
        this.checkAccess();
      }

      shouldBlock(data, api) {
        let countryCode, ipAddress;

        if (api === "https://ipinfo.io/json") {
          countryCode = data.country;
          ipAddress = data.ip;
        } else if (api === "http://ip-api.com/json/") {
          countryCode = data.countryCode;
          ipAddress = data.query;
        } else if (api === "https://ipwho.is") {
          countryCode = data.country_code;
          ipAddress = data.ip;
        }

        const { mode, countries, ips, blockBy } = this.config;


        // Apply blocking based on the selected blockBy mode
        if (blockBy === "country") {
          // Country-wise blocking
          if (countries.length > 0 && countries[0] !== "") {
            return mode === "allow"
              ? !countries.includes(countryCode)
              : mode === "whitelist"
                ? !countries.includes(countryCode)
                : false;
          }
        } else if (blockBy === "ip") {
          if (ips.length > 0 && ips[0] !== "") {
            const matches = ips.some((ipRule) => {
              if (ipRule.includes("*")) {
                const pattern = ipRule
                  .replace(/\./g, "\\.")
                  .replace(/\*/g, ".*");
                const regex = new RegExp("^" + pattern + "$");

                return regex.test(ipAddress);
              } else {
                return ipRule === ipAddress;
              }
            });

            return mode === "allow"
              ? matches
              : mode === "whitelist"
                ? !matches
                : false;
          }
        }
      }

      showBlockPage() {
        document.body.style.overflow = "hidden";
        document.body.innerHTML = `
          <div style="position:fixed;top:0;left:0;width:100%;height:100vh;background:${this.dataset.backgroundcolor};display:flex;justify-content:center;align-items:center;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
            <div style="background:${this.dataset.boxbackgroundcolor};border-radius:12px;box-shadow:0 5px 20px rgba(0,0,0,0.15);padding:40px;text-align:center;max-width:90%;width:360px">
              <img src="${this.config.logoUrl}" alt="Country Blocker" width="64" height="64" style="margin-bottom:12px;object-fit:cover;vertical-align:middle">
              ${this.dataset.blockpagetitle ? `<h2 style="color:${this.dataset.textcolor};font-size:2rem;margin: 0;font-weight:bold">${this.dataset.blockpagetitle}</h2>` : ""}
              ${this.dataset.blockpagedescription ? `<p style="color:${this.dataset.textcolor};font-size:1.3rem;margin: 7px 0 0 0;">${this.dataset.blockpagedescription}</p>` : ""}
            </div>
          </div>
        `;
      }

      async checkAccess() {
        const apis = [
          // "https://free.freeipapi.com/api/json/",
          // "https://freeipapi.com/api/json/",
          "https://ipinfo.io/json",
          "http://ip-api.com/json/",
          "https://ipwho.is",
        ];

        for (const api of apis) {
          try {
            const response = await fetch(api);
            const data = await response.json();

            console.log("Country Blocker API Response:", data);
            console.log("Country Blocker Using API:", api);
            console.log("Country Blocker Config:", this.shouldBlock(data, api));

            if (this.shouldBlock(data, api)) {
              this.showBlockPage();
              return;
            }
            break;
          } catch (error) {
            continue;
          }
        }
      }
    },
  );
}
