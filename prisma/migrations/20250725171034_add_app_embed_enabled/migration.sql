-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CountryBlockerSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "blockingMode" TEXT NOT NULL DEFAULT 'disabled',
    "countryList" TEXT NOT NULL DEFAULT '',
    "blockPageTitle" TEXT NOT NULL DEFAULT 'Access Restricted',
    "blockPageDescription" TEXT NOT NULL DEFAULT 'This store is not available in your country.',
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "boxBackgroundColor" TEXT NOT NULL DEFAULT '#e86161',
    "logoUrl" TEXT,
    "blockedIpAddresses" TEXT NOT NULL DEFAULT '',
    "appEmbedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CountryBlockerSettings" ("backgroundColor", "blockPageDescription", "blockPageTitle", "blockedIpAddresses", "blockingMode", "boxBackgroundColor", "countryList", "createdAt", "id", "logoUrl", "shop", "textColor", "updatedAt") SELECT "backgroundColor", "blockPageDescription", "blockPageTitle", "blockedIpAddresses", "blockingMode", "boxBackgroundColor", "countryList", "createdAt", "id", "logoUrl", "shop", "textColor", "updatedAt" FROM "CountryBlockerSettings";
DROP TABLE "CountryBlockerSettings";
ALTER TABLE "new_CountryBlockerSettings" RENAME TO "CountryBlockerSettings";
CREATE UNIQUE INDEX "CountryBlockerSettings_shop_key" ON "CountryBlockerSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
