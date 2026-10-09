import 'server-only';

/**
 * Every suggestion kind registers itself on import; this file is the one list of them. The queue
 * shows nothing for a kind until it is imported here, so no unfinished kind can appear in the panel.
 * Kinds: cutting plan (Faz 4 defaults), stock count import, purchase draft from the stock threshold,
 * mark an order delivered after its installation is done or signed.
 */
import './kinds/cutting-plan';
import './kinds/count-import';
import './kinds/purchase-draft';
import './kinds/mark-delivered';
