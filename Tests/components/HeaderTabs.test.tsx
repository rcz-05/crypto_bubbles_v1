import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderTabs } from "../../web/src/components/HeaderTabs";

describe("HeaderTabs", () => {
  it("renders all tab options and reports the newly selected value", () => {
    const onChange = vi.fn();

    render(
      <HeaderTabs options={["Hour", "Day", "Week"]} active="Day" onChange={onChange} />,
    );

    expect(screen.getByRole("button", { name: "Hour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day" })).toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(onChange).toHaveBeenCalledWith("Week");
  });
});
