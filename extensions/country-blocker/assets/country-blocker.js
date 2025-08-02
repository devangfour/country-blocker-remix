if (!customElements.get("country-blocker")) {
  customElements.define(
    "country-blocker",
    class CountryBlocker extends HTMLElement {
      constructor() {
        super();
        console.log("Country Blocker initialized");
        console.log("Country Blocker dataset:", this.dataset);

        this.hasCountryBlocker = this.dataset.countryblocker === "true";
        if (this.hasCountryBlocker) {
          this.countryBlockMode = this.dataset.countryblockmode;
          this.countryList = this.dataset.countrylist
            ? this.dataset.countrylist.split(",")
            : [];
          this.countryBlockTitle = this.dataset.countryblocktitle;
          this.countryBlockDescription = this.dataset.countryblockdescription;
        }

        this.init();
      }

      init() {
        if (this.hasCountryBlocker) {
          this.countryBlocker();
        }
      }

      showCountryBlockPopup() {
        const overlay = document.createElement("div");
        overlay.id = "country-block-overlay";
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background: #f9fafb;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        `;

        overlay.innerHTML = `
          <div style="background:#fff;border:1px solid #ddd;border-radius:12px;box-shadow:0 5px 20px rgba(0,0,0,0.15);padding:40px;text-align:center;max-width:90%;width:360px;">
            <div style="margin-bottom:20px;">
              <img src="https://cdn-icons-png.flaticon.com/512/565/565547.png" alt="Protection Logo" width="64" height="64" />
            </div>
            <h2 style="color:#d32f2f;font-size:2rem;margin-bottom:10px;font-weight:bold">${this.countryBlockTitle}</h2>
            <p style="color:#555;font-size:1.3rem;">
              ${this.countryBlockDescription}
            </p>
          </div>
        `;

        document.body.style.overflow = "hidden";

        document.body.appendChild(overlay);

        if (!this.countryBlockTitle || this.countryBlockTitle.trim() === "") {
          const titleElem = overlay.querySelector("h2");
          if (titleElem) titleElem.remove();
        }

        if (
          !this.countryBlockDescription ||
          this.countryBlockDescription.trim() === ""
        ) {
          const descElem = overlay.querySelector("p");
          if (descElem) descElem.remove();
        }

        const protectorBlocks = Array.from(
          document.querySelectorAll('div[data-block-handle="shop-protector"]'),
        );

        document.body.innerHTML = "";

        protectorBlocks.forEach((block) => {
          document.body.appendChild(block);
        });
      }

      countryBlocker() {
        fetch("https://freeipapi.com/api/json/")
          .then((res) => res.json())
          .then((data) => {
            const countryCode = data.countryCode;
            let shouldBlock = false;
            if (this.countryBlockMode === "block") {
              shouldBlock = this.countryList.includes(countryCode);
            } else if (this.countryBlockMode === "whitelist") {
              shouldBlock = !this.countryList.includes(countryCode);
            }

            if (shouldBlock) {
              this.showCountryBlockPopup();
            }
          })
          .catch(() => {
            // Optionally handle errors
          });
      }
    },
  );
}
