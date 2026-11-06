import { render, screen } from "@testing-library/react";
import { reportServerError } from "@/lib/observability/report-server-error";
import Page from "@/app/(dashboard)/production/pilot-readiness/page";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { pilotReadinessReport } from "@/lib/features/manufacturing/pilot-readiness.service";

jest.mock("@/lib/observability/report-server-error", () => ({ reportServerError: jest.fn() }));
jest.mock("server-only", () => ({}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
jest.mock("@/lib/features/manufacturing/pilot-readiness.service", () => ({
  pilotReadinessReport: jest.fn(),
}));
jest.mock("@/lib/features/work-orders/security", () => ({
  requireWorkOrderActor: jest.fn(),
  WorkOrderApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
const actor = { userId: "u", tenantId: "a", role: "admin" as const };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireWorkOrderActor).mockResolvedValue(actor);
});

it("redirects an unauthenticated request without reading the report", async () => {
  jest
    .mocked(requireWorkOrderActor)
    .mockRejectedValue(new WorkOrderApiError("Unauthorized", 401));
  await expect(Page()).rejects.toThrow("REDIRECT:/auth/login");
  expect(pilotReadinessReport).not.toHaveBeenCalled();
  expect(reportServerError).not.toHaveBeenCalled();
});

it("redirects a forbidden role and never renders report content", async () => {
  jest
    .mocked(requireWorkOrderActor)
    .mockResolvedValue({ ...actor, role: "office" });
  jest
    .mocked(pilotReadinessReport)
    .mockRejectedValue(new WorkOrderApiError("Forbidden", 403));
  await expect(Page()).rejects.toThrow("REDIRECT:/dashboard");
  expect(reportServerError).not.toHaveBeenCalled();
});

it("renders the honest empty state without forms or write actions", async () => {
  jest.mocked(pilotReadinessReport).mockResolvedValue({
    empty: true,
    findings: [
      {
        code: "RECIPE_MISSING",
        severity: "blocker",
        message: "Makaslı tente aile eşlemesi yok.",
        hint: "Eşlemeyi kontrol edin.",
      },
    ],
  });
  const { container } = render(await Page());
  expect(
    screen.getByText(/Pilot hazırlığı değerlendirilemiyor/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Engel · Makaslı tente/)).toBeInTheDocument();
  expect(container.querySelector("form, button, input")).toBeNull();
});

it("shows a safe unavailable state without server error details or invented results", async () => {
  jest
    .mocked(pilotReadinessReport)
    .mockRejectedValue(new Error("PRIVATE connection detail"));
  render(await Page());
  expect(reportServerError).toHaveBeenCalledWith("pilot-readiness:page", expect.objectContaining({ message: "PRIVATE connection detail" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Rapor okunamadı");
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
});
