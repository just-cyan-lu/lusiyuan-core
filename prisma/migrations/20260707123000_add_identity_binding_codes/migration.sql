CREATE TABLE "identity_binding_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issuerUserId" TEXT NOT NULL,
    "issuerPersonId" TEXT NOT NULL,
    "redeemedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_binding_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "identity_binding_codes_code_key" ON "identity_binding_codes"("code");
CREATE INDEX "identity_binding_codes_issuerUserId_idx" ON "identity_binding_codes"("issuerUserId");
CREATE INDEX "identity_binding_codes_issuerPersonId_idx" ON "identity_binding_codes"("issuerPersonId");
CREATE INDEX "identity_binding_codes_redeemedUserId_idx" ON "identity_binding_codes"("redeemedUserId");
CREATE INDEX "identity_binding_codes_status_idx" ON "identity_binding_codes"("status");
CREATE INDEX "identity_binding_codes_expiresAt_idx" ON "identity_binding_codes"("expiresAt");

ALTER TABLE "identity_binding_codes"
ADD CONSTRAINT "identity_binding_codes_issuerUserId_fkey"
FOREIGN KEY ("issuerUserId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity_binding_codes"
ADD CONSTRAINT "identity_binding_codes_issuerPersonId_fkey"
FOREIGN KEY ("issuerPersonId") REFERENCES "person_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity_binding_codes"
ADD CONSTRAINT "identity_binding_codes_redeemedUserId_fkey"
FOREIGN KEY ("redeemedUserId") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
