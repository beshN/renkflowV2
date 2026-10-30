/**
 * Jest Setup Configuration
 * 
 * Global setup for all tests including:
 * - React Testing Library configuration
 * - Mock implementations
 * - Global test utilities
 */

import '@testing-library/jest-dom';

declare const jest: {
  mock: (...args: unknown[]) => void;
  fn: () => unknown;
};

// ============================================
// Environment Variables
// ============================================

// NODE_ENV is read-only, skip setting it
// process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-purposes';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// ============================================
// Global Mocks
// ============================================

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        tenantId: 'test-tenant-id',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock framer-motion: every motion.<tag> renders the plain element without
// animation props, and hooks behave as if the user prefers reduced motion.
jest.mock('framer-motion', () => {
  const React = require('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileInView', 'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'viewport', 'layout', 'layoutId', 'drag', 'dragConstraints', 'onAnimationComplete', 'transitionEnd']);
  const cache = new Map();
  const motion = new Proxy({}, {
    get: (_target, tag) => {
      if (!cache.has(tag)) {
        const Component = React.forwardRef(({ children, style, ...props }: any, ref: any) => {
          const clean = Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)));
          const plainStyle = style && Object.fromEntries(Object.entries(style).filter(([, value]) => typeof value !== 'object' || value === null));
          return React.createElement(tag, { ...clean, style: plainStyle, ref }, children);
        });
        Component.displayName = `motion.${String(tag)}`;
        cache.set(tag, Component);
      }
      return cache.get(tag);
    },
  });
  const value = (initial = 0) => ({ get: () => initial, set: jest.fn(), on: jest.fn(() => jest.fn()) });
  return {
    motion,
    AnimatePresence: ({ children }: any) => children,
    LayoutGroup: ({ children }: any) => children,
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
    useReducedMotion: () => true,
    useInView: () => true,
    useScroll: () => ({ scrollY: value(), scrollYProgress: value() }),
    useTransform: () => value(),
    useSpring: (input: any) => input,
    useMotionValue: (initial: number) => value(initial),
    animate: () => ({ stop: jest.fn() }),
  };
});

if (typeof window !== "undefined") {
// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
}

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
) as jest.Mock;

// ============================================
// Custom Test Utilities
// ============================================

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress specific React warnings during tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Warning: An update to') ||
        args[0].includes('act(...)'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
