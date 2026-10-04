import { fireEvent, render, screen } from "@testing-library/react";
import { AuthProviders } from "@/lib/features/auth/context/Providers";
jest.mock("next-auth/react", () => ({
  SessionProvider: ({
    children,
    refetchOnWindowFocus,
    refetchWhenOffline,
  }: any) => (
    <div
      data-testid="session-provider"
      data-focus={String(refetchOnWindowFocus)}
      data-offline={String(refetchWhenOffline)}
    >
      {children}
    </div>
  ),
}));
jest.mock("next-themes", () => ({
  ThemeProvider: ({ children }: any) => children,
}));
jest.mock("@/lib/features/auth/context/AuthContext", () => ({
  AuthProvider: ({ children }: any) => children,
}));
jest.mock("@/lib/features/auth/context/SettingsContext", () => ({
  SettingsProvider: ({ children }: any) => children,
}));
jest.mock("@/lib/features/auth/context/ToastContext", () => ({
  ToastProvider: ({ children }: any) => children,
}));
jest.mock("@/lib/i18n", () => ({
  I18nProvider: ({ children }: any) => children,
}));
it("retains the offline workspace when focus changes and resumes session refresh after reconnection", () => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
  let online = true;
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
  try {
    render(
      <AuthProviders>
        <p>Factory workspace</p>
      </AuthProviders>,
    );
    const provider = screen.getByTestId("session-provider");
    expect(provider).toHaveAttribute("data-focus", "true");
    online = false;
    fireEvent(window, new Event("offline"));
    expect(provider).toHaveAttribute("data-focus", "false");
    expect(provider).toHaveAttribute("data-offline", "false");
    expect(screen.getByText("Factory workspace")).toBeInTheDocument();
    online = true;
    fireEvent(window, new Event("online"));
    expect(provider).toHaveAttribute("data-focus", "true");
  } finally {
    if (original) Object.defineProperty(window.navigator, "onLine", original);
    else delete (window.navigator as any).onLine;
  }
});
