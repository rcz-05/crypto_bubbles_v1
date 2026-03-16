import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BubbleChart } from "../../web/src/components/BubbleChart";
import { marketCoins } from "../fixtures/coins";

describe("BubbleChart", () => {
  it("renders the packed bubble board and lets users select a coin", () => {
    const onSelect = vi.fn();

    render(
      <BubbleChart
        data={marketCoins.slice(0, 2)}
        width={900}
        height={640}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByLabelText("Crypto market bubble chart")).toBeInTheDocument();
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();

    fireEvent.click(screen.getByText("BTC").closest("g") as SVGGElement);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ symbol: "btc" }));
  });

  it("renders an empty chart when there is no data", () => {
    render(<BubbleChart data={[]} width={900} height={640} onSelect={vi.fn()} />);

    expect(screen.getByLabelText("Crypto market bubble chart")).toBeInTheDocument();
    expect(screen.queryByText("BTC")).not.toBeInTheDocument();
  });
});
