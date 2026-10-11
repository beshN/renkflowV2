import 'server-only';

/**
 * The one list of proactive detectors: each registers itself (and its suggestion kind) on import.
 * A detector not imported here never runs and never appears in the queue.
 */
import './defs.server';

export { listDetectors, runAllDetectors, runDetector } from './runner.server';
