import { describe, expect, it } from "vitest";
import { nameVariants } from "@/lib/name-abbrev";

describe("penyingkatan nama di kartu", () => {
  it("menyingkat dari kata terakhir, kata pertama tetap utuh", () => {
    expect(nameVariants("Muhammad  Abdurrahman Al-Fatih Nur")).toEqual([
      "Muhammad Abdurrahman Al-Fatih Nur",
      "Muhammad Abdurrahman Al-Fatih N.",
      "Muhammad Abdurrahman A. N.",
      "Muhammad A. A. N.",
    ]);
  });

  it("huruf awal dijadikan kapital, singkatan yang sudah ada dilewati", () => {
    expect(nameVariants("siti aisyah")).toEqual(["siti aisyah", "siti A."]);
    expect(nameVariants("Ahmad Nouval A.")).toEqual(["Ahmad Nouval A.", "Ahmad N. A."]);
  });

  it("nama satu kata tidak diubah", () => {
    expect(nameVariants(" Ahmad ")).toEqual(["Ahmad"]);
  });
});
