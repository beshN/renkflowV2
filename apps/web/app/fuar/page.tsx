import { redirect } from 'next/navigation';

/** The first version of the fair page lived here. */
export default function LegacyFairPage() {
  redirect('/configurator');
}
