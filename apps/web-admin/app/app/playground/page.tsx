import { PlaygroundClient } from '../../playground/playground-client';
import { getCsrfToken } from '@/lib/csrf';

export default async function ShopPlaygroundPage() {
  return <PlaygroundClient csrfToken={await getCsrfToken()} />;
}
