import { describe, it, expect } from "vitest";
import { CreateProfileSchema, BorrowSchema, DepositSchema } from "@/lib/validation/schemas";

describe("CreateProfileSchema", () => {
  const validProfile = {
    project_name: "OpenMetrics",
    description: "A monitoring tools project for cloud-native infra.",
    sources: [
      { url: "https://github.com/org/repo", label: "GitHub" },
      { url: "https://openmetrics.io", label: "Site" },
    ],
  };

  it("accepts valid profile", () => {
    expect(CreateProfileSchema.safeParse(validProfile).success).toBe(true);
  });

  it("rejects too few sources", () => {
    const result = CreateProfileSchema.safeParse({
      ...validProfile,
      sources: [validProfile.sources[0]],
    });
    expect(result.success).toBe(false);
  });

  it("rejects too many sources", () => {
    const result = CreateProfileSchema.safeParse({
      ...validProfile,
      sources: [
        { url: "https://a.com", label: "A" },
        { url: "https://b.com", label: "B" },
        { url: "https://c.com", label: "C" },
        { url: "https://d.com", label: "D" },
        { url: "https://e.com", label: "E" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects HTTP URL", () => {
    const result = CreateProfileSchema.safeParse({
      ...validProfile,
      sources: [
        { url: "http://github.com/org/repo", label: "Bad" },
        { url: "https://docs.example.com", label: "Docs" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects URL with credentials", () => {
    const result = CreateProfileSchema.safeParse({
      ...validProfile,
      sources: [
        { url: "https://user@github.com/repo", label: "Bad" },
        { url: "https://docs.example.com", label: "Docs" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects localhost URL", () => {
    const result = CreateProfileSchema.safeParse({
      ...validProfile,
      sources: [
        { url: "https://localhost/app", label: "Local" },
        { url: "https://docs.example.com", label: "Docs" },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("BorrowSchema", () => {
  it("accepts valid borrow params", () => {
    const result = BorrowSchema.safeParse({
      profile_id: "1",
      collateral_gen: "2.0",
      principal_gen: "2.5",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative amounts", () => {
    const result = BorrowSchema.safeParse({
      profile_id: "1",
      collateral_gen: "-1",
      principal_gen: "2.5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero", () => {
    const result = BorrowSchema.safeParse({
      profile_id: "1",
      collateral_gen: "0",
      principal_gen: "2.5",
    });
    expect(result.success).toBe(false);
  });
});
