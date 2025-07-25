-- CreateTable
CREATE TABLE "CountryBlockerSettings" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CountryBlockerSettings_shop_key" ON "CountryBlockerSettings"("shop");
