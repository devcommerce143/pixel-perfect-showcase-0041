import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTenantUuid, mapTenantCreateResponse, mapTenantPage, mapTenantResponse, TenantCatalogError, TenantProfileRequestError, tenantDetailPath, tenantListPath, toTenantCreateRequest, toTenantProfileUpdateRequest } from "./tenant-mapper.ts";

const tenant = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "ACME",
  name: "Acme",
  status: "ACTIVE",
  dataRegion: "me-central",
  defaultLanguage: "AR",
  timezone: "Asia/Riyadh",
  notes: null,
  primaryAdminUserId: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

describe("tenant catalog mapper", () => {
  it("maps only profile fields, trims text, and preserves nullable notes", () => {
    const request = toTenantProfileUpdateRequest({
      name: "  Acme Updated ",
      notes: "   ",
      defaultLanguage: "ar",
      timezone: " Asia/Riyadh ",
      code: "UNSUPPORTED",
      status: "inactive",
      dataRegion: "unsupported-region",
      planId: "unsupported-plan",
      overrides: { tpsLimit: 10 },
      primaryAdministrator: { email: "ignored@example.com", firstName: "Ignored", lastName: "Admin", preferredLanguage: "en" },
    } as Parameters<typeof toTenantProfileUpdateRequest>[0] & Record<string, unknown>);

    assert.deepEqual(request, {
      name: "Acme Updated",
      notes: null,
      defaultLanguage: "AR",
      timezone: "Asia/Riyadh",
    });
    assert.deepEqual(toTenantProfileUpdateRequest({ notes: null }), { notes: null });
    assert.deepEqual(toTenantProfileUpdateRequest({ notes: " Profile notes " }), { notes: "Profile notes" });
    assert.deepEqual(toTenantProfileUpdateRequest({ defaultLanguage: "en" }), { defaultLanguage: "EN" });
  });

  it("rejects an empty profile patch and empty tenant names", () => {
    assert.throws(() => toTenantProfileUpdateRequest({}), TenantProfileRequestError);
    assert.throws(() => toTenantProfileUpdateRequest({ name: "  " }), TenantProfileRequestError);
    assert.throws(() => toTenantProfileUpdateRequest({ timezone: "  " }), TenantProfileRequestError);
  });

  it("maps the broad form input to only the supported create DTO fields", () => {
    const request = toTenantCreateRequest({
      code: "ACME",
      name: "Acme",
      status: "trial",
      region: "legacy-region",
      dataRegion: "me-central",
      defaultLanguage: "ar",
      timezone: "Asia/Riyadh",
      notes: "Notes",
      planId: "mock-plan-id",
      overrides: { tpsLimit: 12 },
      primaryAdministrator: {
        firstName: "Amina",
        lastName: "Hassan",
        firstNameArabic: "أمينة",
        lastNameArabic: "حسن",
        email: "admin@example.com",
        mobileNumber: "+966500000000",
        jobTitle: "Director",
        department: "IT",
        preferredLanguage: "ar",
      },
    });

    assert.deepEqual(request, {
      code: "ACME",
      name: "Acme",
      dataRegion: "me-central",
      status: "TRIAL",
      defaultLanguage: "AR",
      timezone: "Asia/Riyadh",
      notes: "Notes",
      primaryAdmin: {
        email: "admin@example.com",
        firstName: "Amina",
        lastName: "Hassan",
        firstNameAr: "أمينة",
        lastNameAr: "حسن",
        mobile: "+966500000000",
        preferredLanguage: "AR",
      },
    });
  });

  it("maps and validates the tenant-create response envelope", () => {
    const admin = {
      id: "22222222-2222-4222-8222-222222222222",
      tenantId: tenant.id,
      email: "admin@example.com",
      firstName: "Amina",
      lastName: "Hassan",
      firstNameAr: null,
      lastNameAr: null,
      mobile: null,
      jobTitle: null,
      department: null,
      preferredLanguage: "EN",
      role: "CLIENT_ADMIN",
      status: "INVITED",
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
    assert.deepEqual(mapTenantCreateResponse({ tenant, primaryAdmin: admin }), {
      tenant: mapTenantResponse(tenant),
      primaryAdmin: {
        ...admin,
        preferredLanguage: "en",
        role: "client_admin",
        status: "invited",
      },
    });
    assert.equal(mapTenantCreateResponse({
      tenant: { ...tenant, primaryAdminUserId: null },
      primaryAdmin: null,
    }).primaryAdmin, null);
    assert.throws(() => mapTenantCreateResponse({ tenant, primaryAdmin: { ...admin, status: "ACTIVE" } }), TenantCatalogError);
    assert.throws(() => mapTenantCreateResponse({ tenant: { ...tenant, primaryAdminUserId: null }, primaryAdmin: admin }), TenantCatalogError);
    assert.throws(() => mapTenantCreateResponse({ tenant }), TenantCatalogError);
  });

  it("maps the backend page envelope without adding enrichment data", () => {
    const mapped = mapTenantPage({ items: [tenant], page: 2, pageSize: 20, total: 21 });
    assert.deepEqual(mapped, {
      items: [{
        id: tenant.id,
        code: "ACME",
        name: "Acme",
        status: "active",
        dataRegion: "me-central",
        defaultLanguage: "ar",
        timezone: "Asia/Riyadh",
        notes: null,
        primaryAdminUserId: tenant.primaryAdminUserId,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      }],
      page: 2,
      pageSize: 20,
      total: 21,
    });
    assert.equal("subscription" in mapped.items[0]!, false);
    assert.equal("planName" in mapped.items[0]!, false);
    assert.equal("users" in mapped.items[0]!, false);
  });

  it("validates tenant status, required response fields, and pagination metadata", () => {
    assert.throws(
      () => mapTenantPage({ items: [{ ...tenant, status: "DISABLED" }], page: 1, pageSize: 20, total: 1 }),
      TenantCatalogError,
    );
    assert.throws(
      () => mapTenantPage({ items: [{ ...tenant, primaryAdminUserId: undefined }], page: 1, pageSize: 20, total: 1 }),
      TenantCatalogError,
    );
    assert.throws(
      () => mapTenantPage({ items: [], page: 0, pageSize: 20, total: 0 }),
      TenantCatalogError,
    );
    assert.throws(
      () => mapTenantPage({ items: [], page: 1, pageSize: 101, total: 0 }),
      TenantCatalogError,
    );
  });

  it("maps and validates the standalone tenant detail DTO", () => {
    assert.deepEqual(mapTenantResponse(tenant), {
      id: tenant.id,
      code: "ACME",
      name: "Acme",
      status: "active",
      dataRegion: "me-central",
      defaultLanguage: "ar",
      timezone: "Asia/Riyadh",
      notes: null,
      primaryAdminUserId: tenant.primaryAdminUserId,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    });
    assert.equal(mapTenantResponse({ ...tenant, notes: "" }).notes, "");
    assert.throws(() => mapTenantResponse({ ...tenant, primaryAdminUserId: undefined }), TenantCatalogError);
    assert.throws(() => mapTenantResponse({ ...tenant, createdAt: 4 }), TenantCatalogError);
    assert.throws(() => mapTenantResponse({ ...tenant, createdAt: "not-a-timestamp" }), TenantCatalogError);
    assert.throws(() => mapTenantResponse({ ...tenant, updatedAt: "2026-02-30T00:00:00.000Z" }), TenantCatalogError);
    assert.equal(mapTenantResponse({ ...tenant, createdAt: "2026-10-01T00:00:00Z" }).createdAt, "2026-10-01T00:00:00Z");
    assert.equal(mapTenantResponse({ ...tenant, updatedAt: "2026-10-02T03:00:00+03:00" }).updatedAt, "2026-10-02T03:00:00+03:00");
  });

  it("accepts backend UUIDs of any version and rejects malformed IDs", () => {
    assert.equal(isTenantUuid(tenant.id), true);
    assert.equal(isTenantUuid("ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB"), true);
    assert.equal(isTenantUuid("11111111-1111-1111-1111-111111111111"), true);
    assert.equal(isTenantUuid("tenant-123"), false);
    assert.throws(() => mapTenantResponse({ ...tenant, id: "tenant-123" }), TenantCatalogError);
  });

  it("builds only supported pagination parameters and applies backend bounds", () => {
    assert.equal(tenantListPath(3, 50), "/tenants?page=3&pageSize=50");
    assert.equal(tenantListPath(0, 500), "/tenants?page=1&pageSize=100");
    assert.equal(tenantListPath(), "/tenants?page=1&pageSize=20");
    assert.equal(tenantDetailPath("tenant/id"), "/tenants/tenant%2Fid");
  });
});
